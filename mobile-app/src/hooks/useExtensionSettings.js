// src/hooks/useExtensionSettings.js — Custom hook to fetch and update FlirtEasy Automation V2 settings
import { useState, useEffect, useCallback } from 'react';

export default function useExtensionSettings(orchestratorUrl) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch settings from orchestrator
  const fetchSettings = useCallback(async () => {
    if (!orchestratorUrl) return;
    try {
      setError(null);
      const res = await fetch(`${orchestratorUrl}/extension-settings`);
      const data = await res.json();
      if (data && data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (e) {
      setError(e.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [orchestratorUrl]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Save settings to orchestrator
  const saveSettings = useCallback(async (updatedSettings) => {
    if (!orchestratorUrl) return false;
    setSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      const res = await fetch(`${orchestratorUrl}/update-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updatedSettings }),
      });
      const data = await res.json();
      if (data && data.success) {
        setSettings(prev => ({ ...prev, ...updatedSettings }));
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        return true;
      } else {
        setError(data?.error || 'Failed to update settings');
        return false;
      }
    } catch (e) {
      setError(e.message || 'Save failed');
      return false;
    } finally {
      setSaving(false);
    }
  }, [orchestratorUrl]);

  return {
    settings,
    loading,
    saving,
    error,
    saveSuccess,
    refresh: fetchSettings,
    saveSettings,
  };
}

export { useExtensionSettings };

