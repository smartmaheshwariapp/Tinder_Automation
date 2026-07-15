// Popup entry point - loads all modularized components
// This file is kept for backward compatibility with popup.html

// Load all modules by injecting the module-loader
const moduleLoader = document.createElement('div');
fetch('module-loader.html')
  .then(response => response.text())
  .then(html => {
    moduleLoader.innerHTML = html;
    document.head.appendChild(moduleLoader);
  });
