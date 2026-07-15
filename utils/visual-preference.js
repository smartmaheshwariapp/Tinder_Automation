// Visual Preference Learning System
async function analyzeVisualMatch(photoUrl, likedPhotos, apiKey, aiModel = 'gpt-4o-mini') {
  if (!photoUrl || !likedPhotos || likedPhotos.length === 0) {
    return { score: 50, reason: 'No training data' };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [{
          role: 'system',
          content: `You are a visual preference analyzer. Compare the profile photo to the user's liked photos and rate similarity 0-100. CRITICAL: First check if GENDER matches. If gender does NOT match, score MUST be 0. If gender matches, analyze these visual attributes: age appearance, ethnicity, hair color/style, body build (slim/athletic/curvy), facial features, tattoos/piercings visibility, clothing style, photo setting, makeup style, facial hair (if applicable), overall attractiveness and vibe. Respond with JSON: {"score": number, "reason": "brief explanation"}`
        }, {
          role: 'user',
          content: [
            { type: 'text', text: `Rate this profile photo against my preferences. Check gender first, then compare all visual attributes. My liked photos (${likedPhotos.length} examples): ${likedPhotos.slice(0, 5).join(', ')}` },
            { type: 'image_url', image_url: { url: photoUrl, detail: 'low' } }
          ]
        }],
        temperature: 0.3,
        max_tokens: 100
      })
    });

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    return result;
  } catch (error) {
    console.error('[VisualPreference] Analysis failed:', error);
    return { score: 50, reason: 'Analysis error' };
  }
}

async function getVisualPreferences() {
  const result = await chrome.storage.local.get(['visualPreferences']);
  return result.visualPreferences || {
    enabled: false,
    trained: false,
    likedPhotos: [],
    minScore: 75,
    totalTrained: 0,
    trainingTier: 'none' // none, basic, good, excellent
  };
}

async function saveVisualPreferences(preferences) {
  await chrome.storage.local.set({ visualPreferences: preferences });
}

async function addLikedPhoto(photoUrl) {
  const prefs = await getVisualPreferences();
  if (!prefs.likedPhotos.includes(photoUrl)) {
    prefs.likedPhotos.push(photoUrl);
    prefs.totalTrained = prefs.likedPhotos.length;
    
    // Update training tier
    if (prefs.totalTrained >= 50) {
      prefs.trainingTier = 'excellent';
      prefs.trained = true;
    } else if (prefs.totalTrained >= 30) {
      prefs.trainingTier = 'good';
      prefs.trained = true;
    } else if (prefs.totalTrained >= 20) {
      prefs.trainingTier = 'basic';
      prefs.trained = true;
    } else {
      prefs.trainingTier = 'none';
      prefs.trained = false;
    }
    
    await saveVisualPreferences(prefs);
  }
  return prefs;
}

if (typeof self !== 'undefined') {
  self.analyzeVisualMatch = analyzeVisualMatch;
  self.getVisualPreferences = getVisualPreferences;
  self.saveVisualPreferences = saveVisualPreferences;
  self.addLikedPhoto = addLikedPhoto;
}
