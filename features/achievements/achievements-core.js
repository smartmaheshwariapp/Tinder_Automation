// Achievement Badge System - Core Logic
// Defines all badges, requirements, and unlock logic

// Use window assignments to prevent "already declared" errors on re-injection
window.BADGE_CATALOG = window.BADGE_CATALOG || {
  // ===== COMMON BADGES (8) =====
  theAwakening: {
    id: 'theAwakening',
    name: 'The Awakening',
    description: 'First contact with the neural core',
    requirement: { buttonClicks: 1 },
    rarity: 'legendary',
    icon: '⚡',
    xp: 500
  },
  firstStep: {
    id: 'firstStep',
    name: 'First Swipe',
    description: 'Complete 1 automation cycle',
    requirement: { cyclesRun: 1 },
    rarity: 'common',
    icon: '🎖️',
    xp: 50
  },
  quickStart: {
    id: 'quickStart',
    name: 'Noob Boost',
    description: 'Send 5 likes to warm up',
    requirement: { likesGiven: 5 },
    rarity: 'common',
    icon: '⚡',
    xp: 50
  },
  iceBreaker: {
    id: 'iceBreaker',
    name: 'Ice Breaker',
    description: 'Send 3 AI messages',
    requirement: { messagesSent: 3 },
    rarity: 'common',
    icon: '🧊',
    xp: 50
  },
  chatMaster: {
    id: 'chatMaster',
    name: 'Sliding into DMs',
    description: 'Send 10 AI messages',
    requirement: { messagesSent: 10 },
    rarity: 'common',
    icon: '💬',
    xp: 50
  },
  matchMaker: {
    id: 'matchMaker',
    name: 'It\'s a Match!',
    description: 'Get 5 matches',
    requirement: { matches: 5 },
    rarity: 'common',
    icon: '❤️',
    xp: 50
  },
  likeGiver: {
    id: 'likeGiver',
    name: 'Right Swipe Spree',
    description: 'Send 50 likes',
    requirement: { likesGiven: 50 },
    rarity: 'common',
    icon: '👍',
    xp: 50
  },
  earlyBird: {
    id: 'earlyBird',
    name: 'New User Surge',
    description: 'Active for 3 days',
    requirement: { daysActive: 3 },
    rarity: 'common',
    icon: '🌅',
    xp: 50
  },

  // ===== RARE BADGES (5) =====
  smoothTalker: {
    id: 'smoothTalker',
    name: 'Smooth Operator',
    description: 'Send 100 AI messages',
    requirement: { messagesSent: 100 },
    rarity: 'rare',
    icon: '💎',
    xp: 150
  },
  cleanCloser: {
    id: 'cleanCloser',
    name: 'Number Secured',
    description: 'Achieve 40% reply rate',
    requirement: { replyRate: 40 },
    rarity: 'rare',
    icon: '✨',
    xp: 150
  },
  matchMagnet: {
    id: 'matchMagnet',
    name: 'Top Pick Material',
    description: 'Get 50 matches',
    requirement: { matches: 50 },
    rarity: 'rare',
    icon: '🧲',
    xp: 150
  },
  conversationArchitect: {
    id: 'conversationArchitect',
    name: 'Rizz Warlord',
    description: '10+ active message threads',
    requirement: { activeThreads: 10 },
    rarity: 'rare',
    icon: '🏗️',
    xp: 150
  },
  weekWarrior: {
    id: 'weekWarrior',
    name: 'Streak Keeper',
    description: 'Active for 7 days in a row',
    requirement: { consecutiveDays: 7 },
    rarity: 'rare',
    icon: '⚔️',
    xp: 150
  },

  // ===== EPIC BADGES (3) =====
  flirtMaster: {
    id: 'flirtMaster',
    name: 'Mr. Right',
    description: 'Send 500 AI messages',
    requirement: { messagesSent: 500 },
    rarity: 'epic',
    icon: '👑',
    xp: 300
  },
  dateNight: {
    id: 'dateNight',
    name: 'Touch Grass',
    description: 'Arrange 5 dates',
    requirement: { datesArranged: 5 },
    rarity: 'epic',
    icon: '🌹',
    xp: 300
  },
  respectfulRizz: {
    id: 'respectfulRizz',
    name: 'Walking Green Flag',
    description: '0 reports + 50 long chats',
    requirement: { reports: 0, longChats: 50 },
    rarity: 'epic',
    icon: '🎩',
    xp: 300
  },

  // ===== LEGENDARY BADGES (2) =====
  theArchitect: {
    id: 'theArchitect',
    name: 'God Mode',
    description: 'You see the matrix of the dating market',
    requirement: { messagesSent: 1000, matches: 100, replyRate: 50 },
    rarity: 'legendary',
    icon: '🏆',
    xp: 1000
  },
  phantomCloser: {
    id: 'phantomCloser',
    name: 'The Unghostable',
    description: 'They can\'t ignore you now',
    requirement: { datesArranged: 20, replyRate: 60 },
    rarity: 'legendary',
    icon: '👻',
    xp: 1000
  }
};

// Premium Vector Icons Map - HYPER LUXURY EDITION
window.BADGE_ICONS = window.BADGE_ICONS || {
  // LEGENDARY (The Awakening)
  theAwakening: `
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFEB3B" />
          <stop offset="30%" stop-color="#FFC107" />
          <stop offset="70%" stop-color="#FF9800" />
          <stop offset="100%" stop-color="#FF6F00" />
        </linearGradient>
        <linearGradient id="gemGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#40C4FF" />
          <stop offset="50%" stop-color="#00B0FF" />
          <stop offset="100%" stop-color="#01579B" />
        </linearGradient>
        <filter id="dropGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
        </filter>
      </defs>
      <circle cx="100" cy="100" r="70" fill="url(#goldGrad)" opacity="0.3" filter="url(#dropGlow)" />
      <path d="M100 20 L160 50 V90 C160 140 100 170 100 170 C100 170 40 140 40 90 V50 L100 20 Z" 
            fill="url(#goldGrad)" stroke="white" stroke-width="2" />
      <path d="M100 60 L130 90 L100 130 L70 90 L100 60 Z" fill="url(#gemGrad)" stroke="white" stroke-width="1" />
      <path d="M100 60 L115 90 L100 110 L85 90 L100 60 Z" fill="white" opacity="0.4" />
    </svg>`,

  // COMMON (Sapphire & Chrome Theme)
  firstStep: `
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="chrome_fs" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F8FAFC" /><stop offset="30%" stop-color="#CBD5E1" /><stop offset="70%" stop-color="#64748B" /><stop offset="100%" stop-color="#334155" /></linearGradient>
        <linearGradient id="sapphire_fs" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#BAE6FD" /><stop offset="50%" stop-color="#38BDF8" /><stop offset="100%" stop-color="#0369A1" /></linearGradient>
        <filter id="glow_fs" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="5" /></filter>
      </defs>
      <circle cx="100" cy="100" r="80" stroke="url(#sapphire_fs)" stroke-width="1" opacity="0.2" />
      <path d="M100 20 L160 100 L100 180 L40 100 Z" fill="url(#sapphire_fs)" opacity="0.15" filter="url(#glow_fs)" />
      <path d="M100 25 L170 55 V115 C170 160 100 185 100 185 S30 160 30 115 V55 L100 25 Z" fill="url(#chrome_fs)" stroke="white" stroke-width="2" />
      <circle cx="100" cy="102" r="45" fill="url(#sapphire_fs)" stroke="white" stroke-width="1.5" />
      <path d="M75 102 L93 120 L130 83" stroke="white" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M100 57 C120 57 135 70 140 100" stroke="white" stroke-width="3" opacity="0.4" stroke-linecap="round" />
    </svg>`,

  quickStart: `
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="chrome_qs" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F8FAFC" /><stop offset="50%" stop-color="#94A3B8" /><stop offset="100%" stop-color="#334155" /></linearGradient>
        <linearGradient id="sapphire_qs" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#BAE6FD" /><stop offset="100%" stop-color="#0284C7" /></linearGradient>
        <filter id="glow_qs" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      <path d="M100 20 L160 50 V90 C160 140 100 170 100 170 S40 140 40 90 V50 L100 20 Z" fill="url(#chrome_qs)" stroke="white" stroke-width="2" />
      <circle cx="100" cy="100" r="50" fill="url(#sapphire_qs)" opacity="0.3" filter="url(#glow_qs)" />
      <path d="M115 50 L65 110 H105 L95 160 L145 100 H105 L115 50 Z" fill="white" filter="url(#glow_qs)" />
      <path d="M115 50 L65 110 H105 L95 160 L145 100 H105 L115 50 Z" fill="white" />
      <path d="M100 40 L115 55 L100 70 L85 55 Z" fill="white" opacity="0.4" />
    </svg>`,

  iceBreaker: `
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="chrome_ib" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F8FAFC" /><stop offset="50%" stop-color="#94A3B8" /><stop offset="100%" stop-color="#334155" /></linearGradient>
        <linearGradient id="sapphire_ib" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#BAE6FD" /><stop offset="100%" stop-color="#0284C7" /></linearGradient>
      </defs>
      <circle cx="100" cy="100" r="85" stroke="url(#chrome_ib)" stroke-width="1" opacity="0.3" />
      <path d="M100 30 L160 60 V120 L100 170 L40 120 V60 L100 30 Z" fill="url(#chrome_ib)" stroke="white" stroke-width="2" />
      <rect x="65" y="75" width="70" height="50" rx="10" fill="url(#sapphire_ib)" stroke="white" stroke-width="1.5" />
      <path d="M65 90 H135 M65 110 H135" stroke="white" stroke-width="1" opacity="0.4" />
      <path d="M85 75 V125 M115 75 V125" stroke="white" stroke-width="2" opacity="0.2" />
      <path d="M100 50 L110 60 L100 70 L90 60 Z" fill="white" opacity="0.3" />
    </svg>`,

  chatMaster: `
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="chrome_cm" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F8FAFC" /><stop offset="50%" stop-color="#94A3B8" /><stop offset="100%" stop-color="#334155" /></linearGradient>
        <linearGradient id="sapphire_cm" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#BAE6FD" /><stop offset="100%" stop-color="#0284C7" /></linearGradient>
      </defs>
      <circle cx="100" cy="100" r="90" stroke="url(#sapphire_cm)" stroke-width="0.5" opacity="0.2" />
      <path d="M100 20 L165 50 V110 C165 150 100 175 100 175 S35 150 35 110 V50 L100 20 Z" fill="url(#chrome_cm)" stroke="white" stroke-width="2" />
      <path d="M70 75 H130 V125 H90 L70 145 V75Z" fill="url(#sapphire_cm)" stroke="white" stroke-width="1.5" />
      <circle cx="85" cy="100" r="5" fill="white" />
      <circle cx="100" cy="100" r="5" fill="white" />
      <circle cx="115" cy="100" r="5" fill="white" />
      <path d="M100 40 L115 55 L100 70 L85 55 Z" fill="white" opacity="0.3" />
    </svg>`,

  matchMaker: `
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="chrome_mm" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F8FAFC" /><stop offset="50%" stop-color="#94A3B8" /><stop offset="100%" stop-color="#334155" /></linearGradient>
        <linearGradient id="sapphire_mm" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#BAE6FD" /><stop offset="100%" stop-color="#0284C7" /></linearGradient>
      </defs>
      <path d="M100 30 L160 60 V120 L100 170 L40 120 V60 L100 30 Z" fill="url(#chrome_mm)" stroke="white" stroke-width="2" />
      <path d="M100 145 L85 130 C65 110 50 95 50 75 C50 55 65 40 85 40 C95 40 105 45 110 55 C115 45 125 40 135 40 C155 40 170 55 170 75 C170 95 155 110 135 130 L115 150 L100 145 Z" 
            fill="url(#sapphire_mm)" stroke="white" stroke-width="2" />
      <path d="M100 80 L110 90 L130 70" stroke="white" stroke-width="8" stroke-linecap="round" opacity="0.8" />
      <circle cx="100" cy="100" r="80" stroke="white" stroke-width="0.5" opacity="0.2" />
    </svg>`,

  likeGiver: `
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="chrome_lg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F8FAFC" /><stop offset="50%" stop-color="#94A3B8" /><stop offset="100%" stop-color="#334155" /></linearGradient>
        <linearGradient id="sapphire_lg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#BAE6FD" /><stop offset="100%" stop-color="#0284C7" /></linearGradient>
      </defs>
      <circle cx="100" cy="100" r="85" fill="url(#sapphire_lg)" opacity="0.1" />
      <path d="M100 20 L170 55 V115 C170 160 100 185 100 185 S30 160 30 115 V55 L100 20 Z" fill="url(#chrome_lg)" stroke="white" stroke-width="2" />
      <circle cx="100" cy="100" r="45" fill="url(#sapphire_lg)" stroke="white" stroke-width="2" />
      <path d="M100 70 C110 70 120 80 120 95 V115 C120 125 110 135 100 135 S80 125 80 115 V95 C80 80 90 70 100 70Z" fill="white" />
      <path d="M90 85 H110" stroke="#0284C7" stroke-width="4" opacity="0.3" stroke-linecap="round" />
      <path d="M100 40 L115 55 L100 70 L85 55 Z" fill="white" opacity="0.4" />
    </svg>`,

  earlyBird: `
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="chrome_eb" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F8FAFC" /><stop offset="50%" stop-color="#94A3B8" /><stop offset="100%" stop-color="#334155" /></linearGradient>
        <linearGradient id="sapphire_eb" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#BAE6FD" /><stop offset="100%" stop-color="#0284C7" /></linearGradient>
      </defs>
      <path d="M100 30 L160 60 V120 L100 170 L40 120 V60 L100 30 Z" fill="url(#chrome_eb)" stroke="white" stroke-width="2" />
      <circle cx="100" cy="100" r="45" fill="url(#sapphire_eb)" stroke="white" stroke-width="2" />
      <path d="M100 70 V105 H125" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="100" cy="100" r="65" stroke="white" stroke-width="1" opacity="0.2" />
    </svg>`,

  // RARE (Cobalt & Indigo Theme)
  smoothTalker: `
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cobalt_st" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#C7D2FE" /><stop offset="30%" stop-color="#818CF8" /><stop offset="70%" stop-color="#4F46E5" /><stop offset="100%" stop-color="#312E81" /></linearGradient>
        <linearGradient id="indigo_st" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#E0E7FF" /><stop offset="100%" stop-color="#6366F1" /></linearGradient>
        <filter id="glow_st" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="5" /></filter>
      </defs>
      <circle cx="100" cy="100" r="85" stroke="url(#indigo_st)" stroke-width="1" opacity="0.3" />
      <path d="M100 20 L180 60 V140 L100 180 L20 140 V60 L100 20 Z" fill="url(#cobalt_st)" stroke="white" stroke-width="2.5" />
      <path d="M100 50 L140 85 L125 140 L100 160 L75 140 L60 85 L100 50 Z" fill="url(#indigo_st)" stroke="white" stroke-width="1.5" />
      <path d="M80 95 Q100 115 120 95" stroke="white" stroke-width="8" stroke-linecap="round" />
      <path d="M100 65 L115 80 L100 95 L85 80 Z" fill="white" opacity="0.4" />
    </svg>`,

  cleanCloser: `
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cobalt_cc" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#C7D2FE" /><stop offset="50%" stop-color="#4F46E5" /><stop offset="100%" stop-color="#312E81" /></linearGradient>
        <linearGradient id="indigo_cc" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#E0E7FF" /><stop offset="100%" stop-color="#6366F1" /></linearGradient>
      </defs>
      <path d="M100 15 L180 50 V150 L100 185 L20 150 V50 L100 15 Z" fill="url(#cobalt_cc)" opacity="0.15" filter="url(#glow_st)" />
      <path d="M100 20 L180 60 V140 L100 180 L20 140 V60 L100 20 Z" fill="url(#cobalt_cc)" stroke="white" stroke-width="2.5" />
      <circle cx="100" cy="100" r="50" fill="url(#indigo_cc)" stroke="white" stroke-width="2" />
      <path d="M70 100 L95 125 L135 80" stroke="white" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="100" cy="100" r="70" stroke="white" stroke-width="0.5" opacity="0.3" />
    </svg>`,

  matchMagnet: `
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cobalt_ma" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#C7D2FE" /><stop offset="50%" stop-color="#4F46E5" /><stop offset="100%" stop-color="#312E81" /></linearGradient>
        <linearGradient id="indigo_ma" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#E0E7FF" /><stop offset="100%" stop-color="#6366F1" /></linearGradient>
      </defs>
      <path d="M100 20 L180 60 V140 L100 180 L20 140 V60 L100 20 Z" fill="url(#cobalt_ma)" stroke="white" stroke-width="2.5" />
      <path d="M70 60 V140 Q70 160 100 160 Q130 160 130 140 V60 H110 V130 Q110 145 100 145 Q90 145 90 130 V60 H70Z" 
            fill="url(#indigo_ma)" stroke="white" stroke-width="1.5" />
      <rect x="70" y="60" width="20" height="30" fill="#EF4444" stroke="white" stroke-width="1" />
      <rect x="110" y="60" width="20" height="30" fill="#EF4444" stroke="white" stroke-width="1" />
      <circle cx="100" cy="100" r="85" stroke="white" stroke-width="0.5" opacity="0.2" />
    </svg>`,

  conversationArchitect: `
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cobalt_ar" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#C7D2FE" /><stop offset="50%" stop-color="#4F46E5" /><stop offset="100%" stop-color="#312E81" /></linearGradient>
      </defs>
      <path d="M100 20 L180 60 V140 L100 180 L20 140 V60 L100 20 Z" fill="url(#cobalt_ar)" stroke="white" stroke-width="2.5" />
      <rect x="55" y="130" width="90" height="15" rx="5" fill="white" opacity="0.9" />
      <rect x="65" y="105" width="70" height="15" rx="5" fill="white" opacity="0.6" />
      <rect x="75" y="80" width="50" height="15" rx="5" fill="white" opacity="0.3" />
      <path d="M100 35 L115 55 H85 L100 35Z" fill="white" />
    </svg>`,

  weekWarrior: `
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cobalt_ww" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#C7D2FE" /><stop offset="50%" stop-color="#4F46E5" /><stop offset="100%" stop-color="#312E81" /></linearGradient>
        <linearGradient id="indigo_ww" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#E0E7FF" /><stop offset="100%" stop-color="#6366F1" /></linearGradient>
      </defs>
      <circle cx="100" cy="100" r="75" fill="url(#indigo_ww)" opacity="0.1" filter="url(#glow_st)" />
      <path d="M100 20 L180 60 V140 L100 180 L20 140 V60 L100 20 Z" fill="url(#cobalt_ww)" stroke="white" stroke-width="2.5" />
      <circle cx="100" cy="100" r="55" fill="url(#indigo_ww)" stroke="white" stroke-width="2" />
      <text x="100" y="128" font-family="'Montserrat', sans-serif" font-size="80" font-weight="900" text-anchor="middle" fill="white">7</text>
    </svg>`,

  // EPIC (Amethyst & Royal Theme)
  flirtMaster: `
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="amethyst_fm" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F5D0FE" /><stop offset="30%" stop-color="#D8B4FE" /><stop offset="70%" stop-color="#A855F7" /><stop offset="100%" stop-color="#6B21A8" /></linearGradient>
        <linearGradient id="royal_fm" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FAE8FF" /><stop offset="100%" stop-color="#D946EF" /></linearGradient>
        <filter id="glow_fm" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="6" /></filter>
      </defs>
      <circle cx="100" cy="100" r="90" stroke="url(#amethyst_fm)" stroke-width="1" opacity="0.3" />
      <path d="M100 10 L185 100 L100 190 L15 100 Z" fill="url(#amethyst_fm)" opacity="0.2" filter="url(#glow_fm)" />
      <path d="M100 15 L185 55 V125 C185 170 100 195 100 195 S15 170 15 125 V55 L100 15 Z" fill="url(#amethyst_fm)" stroke="white" stroke-width="3" />
      <path d="M60 145 L80 80 L100 115 L120 80 L140 145 H60Z" fill="url(#royal_fm)" stroke="white" stroke-width="2" />
      <circle cx="60" cy="80" r="12" fill="white" filter="url(#glow_fm)" />
      <circle cx="100" cy="115" r="12" fill="white" filter="url(#glow_fm)" />
      <circle cx="140" cy="80" r="12" fill="white" filter="url(#glow_fm)" />
      <path d="M100 45 L115 60 L100 75 L85 60 Z" fill="white" opacity="0.4" />
    </svg>`,

  dateNight: `
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="amethyst_dn" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F5D0FE" /><stop offset="50%" stop-color="#A855F7" /><stop offset="100%" stop-color="#6B21A8" /></linearGradient>
        <linearGradient id="royal_dn" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FAE8FF" /><stop offset="100%" stop-color="#D946EF" /></linearGradient>
      </defs>
      <path d="M100 15 L185 55 V125 C185 170 100 195 100 195 S15 170 15 125 V55 L100 15 Z" fill="url(#amethyst_dn)" stroke="white" stroke-width="3" />
      <path d="M100 150 L85 135 C55 105 40 90 40 65 C40 45 55 30 75 30 C88 30 96 36 100 42 C104 36 112 30 125 30 C145 30 160 45 160 65 C160 90 145 105 115 135 L100 150 Z" 
            fill="url(#royal_dn)" stroke="white" stroke-width="2" />
      <circle cx="100" cy="100" r="85" stroke="white" stroke-width="0.5" opacity="0.3" />
    </svg>`,

  respectfulRizz: `
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="amethyst_rr" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F5D0FE" /><stop offset="50%" stop-color="#A855F7" /><stop offset="100%" stop-color="#6B21A8" /></linearGradient>
        <linearGradient id="royal_rr" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FAE8FF" /><stop offset="100%" stop-color="#D946EF" /></linearGradient>
      </defs>
      <path d="M100 15 L185 55 V125 C185 170 100 195 100 195 S15 170 15 125 V55 L100 15 Z" fill="url(#amethyst_rr)" stroke="white" stroke-width="3" />
      <path d="M85 50 V150" stroke="white" stroke-width="12" stroke-linecap="round" />
      <path d="M85 55 H150 L135 100 H85" fill="url(#royal_rr)" stroke="white" stroke-width="2" />
      <circle cx="85" cy="50" r="10" fill="white" />
      <circle cx="100" cy="100" r="80" stroke="white" stroke-width="1" opacity="0.2" />
    </svg>`,

  // LEGENDARY
  theArchitect: `
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="goldGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFEB3B" />
          <stop offset="100%" stop-color="#FF6F00" />
        </linearGradient>
        <linearGradient id="gemGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#E91E63" />
          <stop offset="100%" stop-color="#880E4F" />
        </linearGradient>
        <filter id="hyperGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
        </filter>
      </defs>
      <path d="M100 20 L180 100 L100 180 L20 100 Z" fill="url(#goldGrad2)" opacity="0.2" filter="url(#hyperGlow)" />
      <path d="M100 30 L170 100 L100 170 L30 100 Z" fill="url(#goldGrad2)" stroke="white" stroke-width="2" />
      <circle cx="100" cy="100" r="40" fill="url(#gemGrad2)" stroke="white" stroke-width="1.5" />
      <path d="M100 75 L115 100 L100 125 L85 100 Z" fill="white" opacity="0.6" />
      <circle cx="100" cy="100" r="60" stroke="white" stroke-width="1" opacity="0.3" />
    </svg>`,

  phantomCloser: `
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="goldGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFEB3B" />
          <stop offset="100%" stop-color="#FF6F00" />
        </linearGradient>
        <linearGradient id="ghostGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#AA00FF" />
          <stop offset="100%" stop-color="#4A148C" />
        </linearGradient>
        <filter id="spectralGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
        </filter>
      </defs>
      <circle cx="100" cy="100" r="75" fill="url(#goldGrad3)" opacity="0.2" filter="url(#spectralGlow)" />
      <path d="M100 30 C60 30 40 70 40 110 V160 L70 145 L100 160 L130 145 L160 160 V110 C160 70 140 30 100 30Z" 
            fill="url(#goldGrad3)" stroke="white" stroke-width="2" />
      <path d="M100 60 C80 60 70 80 70 100 V125 L100 115 L130 125 V100 C130 80 120 60 100 60Z" 
            fill="url(#ghostGrad)" filter="url(#spectralGlow)" />
      <circle cx="85" cy="90" r="8" fill="white" opacity="0.8" />
      <circle cx="115" cy="90" r="8" fill="white" opacity="0.8" />
    </svg>`,
};

window.RARITY_CONFIG = window.RARITY_CONFIG || {
  common: { color1: '#00A3FF', color2: '#3B82F6', effect: 'confetti', duration: 8000 },
  rare: { color1: '#4338ca', color2: '#818cf8', effect: 'sparkles', duration: 10000 },
  epic: { color1: '#A855F7', color2: '#7C3AED', effect: 'explosion', duration: 12000 },
  legendary: { color1: '#FF1F66', color2: '#FFA000', effect: 'explosion', duration: 15000 }
};

window.LEVEL_THRESHOLDS = window.LEVEL_THRESHOLDS || [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000];
window.LEVEL_NAMES = window.LEVEL_NAMES || [
  "Newbie",
  "Beginner",
  "Amateur",
  "Intermediate",
  "Skilled",
  "Advanced",
  "Expert",
  "Pro",
  "Elite",
  "Master"
];



window.calculateLevel = function (xp) {
  for (let i = window.LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= window.LEVEL_THRESHOLDS[i]) {
      return {
        number: i + 1,
        name: window.LEVEL_NAMES[i] || "ALPHA"
      };
    }
  }
  return { number: 1, name: window.LEVEL_NAMES[0] };
}

window.getXPForNextLevel = function (currentXP) {
  const levelInfo = window.calculateLevel(currentXP);
  const currentLevel = levelInfo.number;
  if (currentLevel >= window.LEVEL_THRESHOLDS.length) {
    return { current: currentXP, required: currentXP, progress: 100 };
  }
  const required = window.LEVEL_THRESHOLDS[currentLevel];
  const previous = window.LEVEL_THRESHOLDS[currentLevel - 1];
  const progress = ((currentXP - previous) / (required - previous)) * 100;
  return { current: currentXP, required, progress: Math.min(progress, 100) };
}

window.checkBadgeUnlock = function (badgeId, userStats) {
  const badge = window.BADGE_CATALOG[badgeId];
  if (!badge) return false;

  const req = badge.requirement;
  return Object.keys(req).every(key => (userStats[key] || 0) >= req[key]);
}

window.getAllUnlockedBadges = function (userStats, unlockedBadges) {
  return Object.keys(window.BADGE_CATALOG).filter(id => unlockedBadges.includes(id));
}

window.getNextBadgeProgress = function (userStats, unlockedBadges) {
  const locked = Object.keys(window.BADGE_CATALOG).filter(id => !unlockedBadges.includes(id) && !window.BADGE_CATALOG[id].hidden);

  let closest = null;
  let closestProgress = 0;

  locked.forEach(id => {
    const badge = window.BADGE_CATALOG[id];
    const req = badge.requirement;
    const keys = Object.keys(req);
    const progress = keys.reduce((sum, key) => sum + Math.min((userStats[key] || 0) / req[key], 1), 0) / keys.length * 100;

    if (progress > closestProgress) {
      closestProgress = progress;
      closest = { ...badge, progress, current: userStats[keys[0]] || 0, required: req[keys[0]] };
    }
  });

  return closest;
}

// Expose to window for other scripts (tracker, overlay)
if (typeof window !== 'undefined') {
  window.BADGE_CATALOG = BADGE_CATALOG;
  window.RARITY_CONFIG = RARITY_CONFIG;
  window.LEVEL_THRESHOLDS = LEVEL_THRESHOLDS;
  window.calculateLevel = calculateLevel;
  window.getXPForNextLevel = getXPForNextLevel;
  window.checkBadgeUnlock = checkBadgeUnlock;
  window.getAllUnlockedBadges = getAllUnlockedBadges;
  window.getNextBadgeProgress = getNextBadgeProgress;
  const DEBUG_ENABLED = false;
  if (DEBUG_ENABLED) console.log('[AchievementCore] Exposed globals to window');
}
