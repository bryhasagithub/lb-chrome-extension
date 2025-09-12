// Background script for Chrome extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'NEW_TIP') {
        console.log('New tip received:', request.data);
        // Could add notification here if needed
    }
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Tip Tracker extension installed');
});
