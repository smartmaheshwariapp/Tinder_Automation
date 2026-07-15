
async function handleCheckStopCondition(conversationHistory, stopConditions) {
    if (!stopConditions || stopConditions.length === 0 || stopConditions.includes('never')) {
        return { shouldStop: false, reason: null };
    }

    const settings = await getSettings();
    const apiKey = settings.apiKey;

    // Use the utility imported from /utils/stop-conditions.js
    if (typeof checkStopConditions === 'function') {
        // Provide the background's proxy-aware AI caller
        const aiCaller = async (system, user) => {
            if (typeof callOpenAI === 'function') {
                return await callOpenAI(system, user, apiKey, settings, {
                    temperature: 0,
                    response_format: { type: "json_object" }
                });
            } else {
                throw new Error('callOpenAI utility not available in background');
            }
        };

        return await checkStopConditions(conversationHistory, stopConditions, apiKey, aiCaller);
    } else {
        console.error('[Background] checkStopConditions utility not found');
        return { shouldStop: false, reason: null };
    }
}
