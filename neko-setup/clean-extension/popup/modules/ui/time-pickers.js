function initializeTimePickers() {
  const times = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 1) {
      const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const minute = m.toString().padStart(2, '0');
      const value = `${h.toString().padStart(2, '0')}:${minute}`;
      const display = `${hour}:${minute} ${ampm}`;
      times.push({ value, display });
    }
  }

  setupTimePicker('startTime', 'startTimeDropdown', times);
  setupTimePicker('endTime', 'endTimeDropdown', times);
}

function setupTimePicker(inputId, dropdownId, times) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);

  times.forEach(time => {
    const option = document.createElement('div');
    option.className = 'time-option';
    option.textContent = time.display;
    option.dataset.value = time.value;
    dropdown.appendChild(option);

    option.addEventListener('click', () => {
      input.value = time.display;
      input.dataset.value = time.value;
      dropdown.classList.remove('open');
      dropdown.querySelectorAll('.time-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      updateActiveHoursHint();
      markAsChanged();
    });
  });

  input.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.time-dropdown').forEach(d => {
      if (d !== dropdown) d.classList.remove('open');
    });
    dropdown.classList.toggle('open');

    const currentValue = input.dataset.value || input.value;
    dropdown.querySelectorAll('.time-option').forEach(o => {
      o.classList.toggle('selected', o.dataset.value === currentValue);
    });
  });

  document.addEventListener('click', () => {
    dropdown.classList.remove('open');
  });
}
