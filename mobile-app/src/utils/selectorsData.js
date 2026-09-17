// AUTO-GENERATED — Do not edit manually.
// Run: node scripts/bundle-extension.js
// Source: config/selectors.json

export const SELECTORS_JSON = {
  "buttons": {
    "like": [
      "button:text-equals('Like')",
      "button[aria-label='Like']",
      "button[aria-label='like']"
    ],
    "pass": [
      "button:text-equals('Nope')",
      "button:text-equals('Pass')",
      "button[aria-label='Pass']",
      "button[aria-label='Nope']"
    ],
    "superLike": [
      "button:text-equals('Super Like')",
      "button[aria-label='Super Like']"
    ],
    "closePopup": [
      "button[aria-label*='Close']",
      "button[aria-label='Close']",
      "button:contains('×')",
      "button:contains('X')"
    ]
  },
  "navigation": {
    "explore": [
      "a[href='/app/recs']",
      "a[href*='/app/recs']",
      "a[href*='/recs']",
      "button[aria-label*='Recommendations' i]",
      "a[aria-label*='Recommendations' i]",
      "button[aria-label*='Tinder' i]",
      "a[aria-label*='Tinder' i]",
      "button[aria-label*='Discover' i]",
      "a[aria-label*='Discover' i]",
      "nav a:nth-child(1)"
    ],
    "messages": [
      "a[href='/app/messages']",
      "a[href*='/app/messages']",
      "a[href='/app/my-matches']",
      "a[href*='/app/my-matches']",
      "a[href='/app/matches']",
      "a[href*='/app/matches']",
      "a[href*='/messages']",
      "a[href*='/my-matches']",
      "button[aria-label*='Messages' i]",
      "a[aria-label*='Messages' i]",
      "button[aria-label*='Matches' i]",
      "a[aria-label*='Matches' i]",
      "button[aria-label*='Chat' i]",
      "a[aria-label*='Chat' i]",
      "svg[aria-label*='Messages' i]",
      "svg[aria-label*='Matches' i]",
      "svg[aria-label*='Chat' i]",
      "nav a[href*='messages']",
      "nav a[href*='my-matches']",
      "nav a:nth-child(4)"
    ],
    "profile": [
      "a[href='/app/profile']",
      "a[href*='/profile']"
    ]
  },
  "messaging": {
    "input": [
      "div[role='textbox']",
      "div[aria-label*='message' i][contenteditable]",
      "div[data-testid*='chat'][contenteditable]",
      "div[contenteditable='true']",
      "textarea[placeholder*='message' i]",
      "textarea[placeholder*='Type' i]",
      "textarea[placeholder*='mensaje' i]",
      "textarea[placeholder*='escribe' i]",
      "textarea[placeholder*='Nachricht' i]",
      "textarea[placeholder*='message' i]",
      "textarea[id*='chat']",
      "textarea[maxlength='5000']",
      "input[type='text'][placeholder*='message' i]",
      "[contenteditable='true']",
      "[contenteditable]",
      "textarea"
    ],
    "sendButton": [
      "button[aria-label*='Send' i]",
      "button[data-testid*='send' i]",
      "button[type='submit']",
      "button.sendButton",
      "button[data-testid='send']"
    ],
    "messageList": "div[role='list']",
    "messageBubble": ".msg, .message, [data-testid='message']",
    "unreadIndicator": ".unreadIndicator, .unread, .badge, [data-testid='unread']",
    "matchListItems": "a[href^='/app/messages/']"
  },
  "profile": {
    "name": [
      ".Expand h1",
      "span.Pend\\(8px\\)"
    ],
    "age": [
      ".Expand h1 span",
      "span.Whs\\(nw\\).Typs\\(display-2-strong\\)",
      "span[itemprop='age']"
    ],
    "bio": [
      "div.C\\(\\$c-ds-text-primary\\).Typs\\(body-1-regular\\)",
      "div.P\\(24px\\).W\\(100\\%\\).Bgc\\(\\$c-ds-background-primary\\) div.C\\(\\$c-ds-text-primary\\)",
      ".Expand .BreakWord",
      "div.C\\(\\$c-ds-text-primary\\).Typs\\(body-1-regular\\)"
    ],
    "interests": [
      ".Expand .Bdrs\\(100px\\)",
      "span.Typs\\(display-3-strong\\).C\\(\\$c-ds-text-primary\\).Mstart\\(4px\\)",
      "div.C\\(\\$c-ds-text-primary\\).Typs\\(display-2-strong\\)"
    ],
    "card": [
      ".recsCardboard__cards .Bxsh\\(\\$bxsh-card\\)",
      ".recsCardboard__cardsContainer [data-keyboard-gamepad='true']",
      "div[data-testid='recsCard']",
      "div[data-testid='recCard']",
      "div.recCard",
      "div.profileCard",
      ".keen-slider__slide[aria-hidden='false']",
      "[class*='profileCard' i]",
      "div[aria-label='Profile Card']",
      ".recCard__card"
    ],
    "menuItems": [
      ".menuItem__contents",
      "span.menuItem__contents",
      "div.menuItem__contents",
      "[class*='menuItem']"
    ]
  },
  "overlays": {
    "matchModal": ".matchModal",
    "subscriptionPopup": "div[role='dialog']"
  },
  "injectionPoints": {
    "headerRight": "div.Mend\\(16px\\)--ml"
  }
};
export default SELECTORS_JSON;
