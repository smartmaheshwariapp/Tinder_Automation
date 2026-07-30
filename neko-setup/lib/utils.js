// lib/utils.js — Shared utilities, constants, and state
'use strict';

// ─── Phone Number Parser ───
function parsePhoneNumber(input) {
  let text = input.trim();
  if (text.startsWith('+')) {
    text = text.substring(1);
  } else {
    return { countryCode: null, phoneNumber: text };
  }

  const commonCodes = [
    '91', '44', '49', '33', '81', '86', '7', '39', '34', '55', '52', '61', '64', '31', '32', '41', '46', '47', '45', '90', '20', '27', '98', '62', '65', '60', '66', '84', '82', '92', '94', '880', '971', '966', '972', '353', '351'
  ];

  for (const code of commonCodes) {
    if (code.length === 3 && text.startsWith(code)) {
      return { countryCode: code, phoneNumber: text.substring(3) };
    }
  }
  for (const code of commonCodes) {
    if (code.length === 2 && text.startsWith(code)) {
      return { countryCode: code, phoneNumber: text.substring(2) };
    }
  }
  if (text.startsWith('1')) {
    return { countryCode: '1', phoneNumber: text.substring(1) };
  }
  if (text.length > 10) {
    return { countryCode: text.substring(0, 2), phoneNumber: text.substring(2) };
  }
  return { countryCode: null, phoneNumber: text };
}

// ─── Platform URLs ───
const PLATFORMS = {
  tinder: 'https://tinder.com',
  bumble: 'https://bumble.com/get-started',
  hinge: 'https://hinge.co',
  aisle: 'https://aisle.co'
};

// ─── Shared Mutable State ───
let navReady = false;

function getNavReady() { return navReady; }
function setNavReady(val) { navReady = val; }

module.exports = {
  parsePhoneNumber,
  PLATFORMS,
  getNavReady,
  setNavReady,
};
