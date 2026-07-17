# FlirtEasy – Tinder & Bumble Auto Swiper + AI Messages 🚀

Hey! Is project ke tech stack, architecture aur workflow ka pura details Hinglish me neeche explain kiya gaya hai taaki aapko sab kuch aaram se samajh aa sake.

---

## 🛠️ Humne Kaunsi Tech Use Ki Hai? (Tech Stack)

Yeh project main teen bade components se milkar bana hai jo coordination me kaam karte hain:

### 1. Chrome Extension (Dating Automation & AI Engine)
* **Core Languages**: Pure JavaScript (ES6+), HTML aur CSS (Lightweight aur fast injection ke liye).
* **Manifest Version**: **Manifest V3 (MV3)** compatibility ke saath design kiya gaya hai.
* **OpenAI API Integration**: OpenAI API ke through matches aur current profiles ke personalized content (Bio, prompt, age, etc.) parse karke smart, customized icebreakers and replies generate kiye jaate hain.
* **API Interceptor (`content/api-interceptor.js`)**: Tinder/Bumble ke background traffic calls ko intercept kiya jata hai taaki front-end DOM element structural changes se swiping na tute aur high reliability data access mile.
* **DOM Helpers & Message Senders**: Profile structure identify karne, message simulate karne aur button clicks trigger karne ke scripts.
* **Floating UI Status Bar**: Active metrics, swipes and error status real-time UI pe display karne ke liye vanilla CSS status-bar inject hota hai.
* **Achievements System**: Dynamic milestones tracking feature ke liye modular scripts build kiye gaye hain.

### 2. Mobile App (Guided Login & Live Viewer App)
* **Framework**: **React Native** + **Expo** setup (Fast setup aur debugging capabilities ke liye).
* **Navigation**: `@react-navigation/native` aur stack utilities multi-screen configuration manage karne ke liye.
* **WebView Integration (`react-native-webview`)**: Remote VPS par chalne wale Chromium WebRTC session stream ko app ke andar inject/display karne ke liye use kiya gaya hai.
* **Guided Login System**: User interaction smooth banane ke liye, phone auth aur OTP fields mobile app UI par user se details lekar internal APIs ke through virtual browser me type karwati hain.

### 3. Orchestration & VPS Infrastructure (Background Runner Core)
* **Docker Container Browser (Neko)**: Har client ke liye dedicated virtual Chromium browser Docker environment ke andar run karta hai (using Neko image jo VNC/WebRTC ke through visual streaming browser interface share karti hai).
* **Static Residential (ISP) Proxies**: Tinder/Bumble ke anti-bot detection and shadow-ban policies bypass karne ke liye static residential proxies ka integration hai.
* **Node.js Orchestration API**: Neko virtual key-press triggers aur container status `/start-session` dynamic script se handles karne ke liye side API server (running on port 3000).

---

## 🔄 Project Ka Flow Kaise Kaam Karta Hai? (System Workflow)

Flow bohot straight-forward aur clean hai:

### Step 1: Configuration in Mobile App
1. User Mobile App open karta hai aur dating platform (Tinder ya Bumble) select karta hai.
2. User parameters and preferences set karta hai:
   * **Cycle Limits**: Ek bar me kitne swipe or message automate karne hain.
   * **AI Prompt Rules**: Personalized wingman/intro text preferences.
   * **Social Contacts**: Connect hone ke baad Instagram, WhatsApp, ya Telegram drop karne ke options settings me configure hote hain.

### Step 2: Neko Virtual Browser Spin Up
1. Jab user **"Start Session"** click karta hai, Mobile App orchestrator port `3000` par `POST /start-session` call bhejta hai.
2. Backend script background me targeted user identity ke custom settings load karti hai.
3. Ek **Neko Docker Container** boot ho jata hai jo background me static proxy configure karta hai aur browser instances persist karne ke liye `/data/sessions/user_{id}` volume mount karta hai taaki cookies/auth session remove na hon.
4. Chromium browser automatic pre-installed FlirtEasy extension config sync logic ke sath host system pe chalu ho jata hai.

### Step 3: WebRTC Connect & Guided Login
1. WebRTC client loading screen bypass karte hi WebView client screen open ho jati hai aur live Neko session viewer connect ho jata hai.
2. Agar user logged in nahi hai, to **Guided Wizard** show hota hai.
3. User phone number enter karta hai, to `BrowserScreen` background post requests se virtual key triggers pass karta hai. Input directly remote browser fields me type ho jata hai aur phone login trigger hota hai.
4. User ke pass code (OTP) aata hai to code submit karne par virtual enter command send hota hai aur user safely login complete kar leta hai.

### Step 5: Background Auto-Swiping & AI Chatting
1. Jaise hi user logged-in browser view state me hota hai, Tinder/Bumble profiles load hone par FlirtEasy extension active ho jati.
2. **Profile Data Reading**: API responses aur DOM scraping ke through prospective match ke biodata ko reading scripts check karti hain.
3. **AI Wingman Prompt generation**: Agar settings allowed ho, to extension background process client storage configurations se prompt check karke OpenAI ko match detail fetch API request karti hai aur ek unique, high response-rate introductory line draft kar leti hai.
4. **Action Executed**: Swipe and typing simulations automatically trigger standard timeouts aur natural mouse moves emulate karte hue standard intervals par chalti hain.
5. **Auto messaging**: Initial match hone par automatically generated first dynamic response message sender logic trigger kar deta hai.

### Step 6: Metric Tracking
* Continuous status updates aur success milestones mobile app config screen sync metrics aur chrome local storage state options ko continuous update dete rehte hain aur details achievements section me sync hote hain.
