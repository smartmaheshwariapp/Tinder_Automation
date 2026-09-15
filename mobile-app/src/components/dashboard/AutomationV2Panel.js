import { theme as uiTheme } from "../../theme";
// src/components/dashboard/AutomationV2Panel.js — Comprehensive FlirtEasy V2 Panel with Style Training & Safety Controls
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { View, Text, Switch, ScrollView, StyleSheet } from "react-native";
import {
  FocusInput as TextInput,
  MotionTouchable as TouchableOpacity,
} from "../common/Motion";
import ActivityIndicator from "../common/SafeActivityIndicator";
import {
  LayoutAnimation,
  Platform,
  UIManager,
  Modal,
  Alert,
  Animated,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import RangeSlider from "../common/RangeSlider";
import MultiRangeSlider from "../common/MultiRangeSlider";
import TimeRangeSlider, {
  timeToMins,
  minsToDisplay,
  minsTo24,
} from "../common/TimeRangeSlider";
import V2Dropdown from "../common/V2Dropdown";
import { CITY_PRESETS } from "../../utils/locationHubs";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Feature Flags (Hidden in On-Device mode for clean UX, preserved for future cloud mode) ───
const SHOW_CHAT_STYLE_TRAINING = false;
const SHOW_AI_ACTIVE_TIME = false;
const SHOW_LOCATION_FEATURE = false;
const SHOW_DEFAULT_LANGUAGE = false;

// ─── Goal Options ───
const GOAL_OPTIONS = [
  {
    id: "date",
    label: "Set up a Date",
    desc: "Propose coffee, drinks, dinner or activity",
    icon: "calendar-outline",
  },
  {
    id: "phone",
    label: "Get Phone Number / WhatsApp",
    desc: "Move conversation to WhatsApp or SMS",
    icon: "logo-whatsapp",
  },
  {
    id: "instagram",
    label: "Get Social Media",
    desc: "Exchange Instagram handles and socials",
    icon: "logo-instagram",
  },
  // { id: 'move_to_telegram', label: 'Move to Telegram', desc: 'Direct match to your Telegram username', icon: 'paper-plane-outline' },
  {
    id: "move_to_instagram",
    label: "Move to Instagram (Pitch)",
    desc: "Pitch your IG profile handle directly",
    icon: "camera-outline",
  },
  // { id: 'move_to_tango', label: 'Move to Tango', desc: 'Direct contact transition to Tango', icon: 'call-outline' },
  {
    id: "never",
    label: "Keep Engaging",
    desc: "Continuous natural AI conversation on-app",
    icon: "infinite-outline",
  },
];

const INTENTIONS_OPTIONS = [
  { id: "short_term", label: "Short term dating" },
  { id: "long_term", label: "Long term relationship" },
  { id: "just_fun", label: "Just for fun" },
  { id: "casual_connection", label: "Casual connection" },
  { id: "meaningful_conversations", label: "Meaningful conversations" },
  { id: "open_to_anything", label: "Open to anything" },
  { id: "lets_see", label: "Let's see where it goes" },
];

const TONE_OPTIONS = [
  "Freestyle",
  "Serious",
  "Gentle",
  "Flirty",
  "Playful",
  "Confident",
  "Witty",
  "Charming",
  "Bold",
  "Romantic",
];

const LANGUAGE_OPTIONS = [
  { code: "ar", label: "Arabic", flag: "🇸🇦" },
  { code: "bn", label: "Bengali", flag: "🇧🇩" },
  { code: "zh", label: "Chinese", flag: "🇨🇳" },
  { code: "cs", label: "Czech", flag: "🇨🇿" },
  { code: "da", label: "Danish", flag: "🇩🇰" },
  { code: "nl", label: "Dutch", flag: "🇳🇱" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "fi", label: "Finnish", flag: "🇫🇮" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "el", label: "Greek", flag: "🇬🇷" },
  { code: "he", label: "Hebrew", flag: "🇮🇱" },
  { code: "hi", label: "Hindi", flag: "🇮🇳" },
  { code: "hu", label: "Hungarian", flag: "🇭🇺" },
  { code: "id", label: "Indonesian", flag: "🇮🇩" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "ko", label: "Korean", flag: "🇰🇷" },
  { code: "no", label: "Norwegian", flag: "🇳🇴" },
  { code: "fa", label: "Persian", flag: "🇮🇷" },
  { code: "pl", label: "Polish", flag: "🇵🇱" },
  { code: "pt", label: "Portuguese", flag: "🇧🇷" },
  { code: "ro", label: "Romanian", flag: "🇷🇴" },
  { code: "ru", label: "Russian", flag: "🇷🇺" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "sw", label: "Swahili", flag: "🇰🇪" },
  { code: "sv", label: "Swedish", flag: "🇸🇪" },
  { code: "th", label: "Thai", flag: "🇹🇭" },
  { code: "tr", label: "Turkish", flag: "🇹🇷" },
  { code: "uk", label: "Ukrainian", flag: "🇺🇦" },
  { code: "ur", label: "Urdu", flag: "🇵🇰" },
  { code: "vi", label: "Vietnamese", flag: "🇻🇳" },
];

const PRIORITY_PRESETS = [
  { value: 30, ratio: "70 : 30", desc: "Mostly replies to current chats" },
  {
    value: 50,
    ratio: "50 : 50",
    desc: "Balanced outreach & replies (Recommended)",
  },
  { value: 70, ratio: "30 : 70", desc: "Aggressively messages new matches" },
];

const DATE_GOALS = ["coffee", "drinks", "dinner", "activity"];
const GENDER_OPTIONS = [
  { id: "auto", label: "Auto" },
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
];
const ACTIVE_HOUR_PRESETS = [
  "24/7",
  "Day (9am-10pm)",
  "Evening (6pm-12am)",
  "Custom",
];
const REPLY_LENGTHS = [
  { id: "short", label: "Short & Punchy" },
  { id: "medium", label: "Balanced" },
  { id: "long", label: "Detailed" },
];
const EMOJI_STYLES = [
  { id: "none", label: "None" },
  { id: "subtle", label: "Subtle (1-2)" },
  { id: "expressive", label: "Expressive" },
];

// ─── Multi-Language Localized Practice Match Personas (Desktop V2 Parity) ───
const LOCALIZED_TRAINING_PERSONAS = {
  en: {
    name: "Mia",
    opener:
      "hey! your profile actually made me stop scrolling 👀 what do you do for fun?",
    replies: [
      "haha no way, that's awesome! what's the next thing on your bucket list?",
      "lol i love that energy. what are you usually up to on weekends?",
      "okay i like your vibe honestly 😊 what's your ideal first date?",
      "haha totally agree! do you prefer spontaneous trips or planned itineraries?",
      "such a great answer! what's your go-to comfort food after a long day?",
      "love that. what kind of music or concerts are you into lately?",
      "same here! are you more of a night owl or an early bird?",
      "haha i can tell you're fun to hang with. what's your favorite spot in town?",
      "that's such a good place! do you have any fun hobbies nobody expects?",
      "wow that's super interesting! what's something that always makes you laugh?",
      "haha perfect. i feel like i really have a feel for your personality and texting vibe now ✨",
    ],
  },
  es: {
    name: "Sofía",
    opener:
      "¡hola! tu perfil me llamó mucho la atención 👀 ¿qué te gusta hacer en tu tiempo libre?",
    replies: [
      "¡jaja no te creo, qué genial! ¿cuál es el próximo plan en tu lista de deseos?",
      "me encanta esa energía jaja. ¿qué sueles hacer los fines de semana?",
      "me gusta mucho tu vibra la verdad 😊 ¿cómo sería tu primera cita ideal?",
      "¡totalmente de acuerdo! ¿prefieres viajes espontáneos o planear todo con detalle?",
      "¡qué buena respuesta! ¿cuál es tu comida favorita para relajarte después de un día largo?",
      "me encanta. ¿qué tipo de música o conciertos escuchas últimamente?",
      "¡igual yo! ¿eres más de salir de noche o levantarte temprano?",
      "jaja se nota que es divertido salir contigo. ¿cuál es tu lugar favorito de la ciudad?",
      "¡un clásico! ¿tienes algún hobby que la gente no se esperaría de ti?",
      "¡qué interesante! ¿qué es algo que siempre te hace reír?",
      "¡perfecto! ya siento que tengo bien captado tu estilo y vibra para chatear ✨",
    ],
  },
  fr: {
    name: "Camille",
    opener:
      "salut ! ton profil m'a direct tapé dans l'œil 👀 qu'est-ce que tu aimes faire pour t'amuser ?",
    replies: [
      "haha pas mal du tout ! c'est quoi le prochain truc sur ta liste de rêves ?",
      "j'adore cette énergie lol. tu fais quoi en général le week-end ?",
      "j'aime beaucoup ton feeling honnêtement 😊 c'est quoi ton premier date idéal ?",
      "haha tellement d'accord ! plutôt voyages improvisés ou tout planifié à l'avance ?",
      "trop bonne réponse ! c'est quoi ton plat réconfortant après une grosse journée ?",
      "j'adore. tu écoutes quoi comme musique ou artistes en ce moment ?",
      "pareil pour moi ! plutôt oiseau de nuit ou lève-tôt ?",
      "haha on voit direct que tu es sympa. c'est quoi ton endroit préféré en ville ?",
      "tellement un bon spot ! tu as une passion secrète que personne ne soupçonne ?",
      "génial ça ! qu'est-ce qui te fait toujours rire aux éclats ?",
      "parfait ! j'ai vraiment bien cerné ton rythme de message et ton style maintenant ✨",
    ],
  },
  de: {
    name: "Lena",
    opener:
      "hey! dein profil hat mich sofort neugierig gemacht 👀 was machst du am liebsten in deiner freizeit?",
    replies: [
      "haha cool! was steht als nächstes ganz oben auf deiner bucket list?",
      "ich mag deine energie lol. was machst du meistens am wochenende?",
      "du hast echt einen sympathischen vibe 😊 wie sieht dein ideales erstes date aus?",
      "haha vollkommen einverstanden! bist du eher spontan oder planst du gerne alles vorab?",
      "gute antwort! was ist dein lieblingsessen nach einem langen tag?",
      "mega. welche musik oder konzerte feierst du im moment?",
      "bei mir genauso! bist du eher nachtaktiv oder frühaufsteher?",
      "haha man merkt, dass es mit dir nie langweilig wird. wo bist du in der stadt am liebsten?",
      "das ist ein toller ort! hast du ein hobby, das man dir nicht direkt zutraut?",
      "super spannend! was bringt dich eigentlich immer zum lachen?",
      "perfekt! ich habe jetzt ein richtig gutes gefühl für deinen schreibstil und rhythmus ✨",
    ],
  },
  it: {
    name: "Giulia",
    opener:
      "ciao! il tuo profilo mi ha davvero colpito 👀 cosa ti piace fare nel tempo libero?",
    replies: [
      "haha fantastico! qual è la prossima cosa nella tua lista dei desideri?",
      "adoro questa energia haha. cosa fai di solito nei weekend?",
      "mi piace molto la tua vibra sinceramente 😊 come sarebbe il tuo primo appuntamento ideale?",
      "haha totalmente d'accordo! preferisci viaggi spontanei o itinerari super organizzati?",
      "ottima risposta! qual è il tuo comfort food preferito dopo una giornata pesante?",
      "bello! che musica o concerti stai ascoltando ultimamente?",
      "anche io! sei più un tipo notturno o mattiniero?",
      "haha si vede subito che è divertente uscire con te. qual è il tuo posto preferito in città?",
      "ottima scelta! hai qualche hobby particolare che nessuno si aspetterebbe?",
      "super interessante! cos'è una cosa che ti fa sempre ridere?",
      "perfetto! ora ho capito benissimo il tuo stile di messaggiare e il tuo ritmo ✨",
    ],
  },
  pt: {
    name: "Beatriz",
    opener:
      "oi! o teu perfil chamou mesmo a minha atenção 👀 o que gostas de fazer nos tempos livres?",
    replies: [
      "haha que fixe! qual é a próxima coisa na tua lista de desejos?",
      "adoro essa energia lol. o que costumas fazer aos fins de semana?",
      "gosto muito da tua vibe sinceramente 😊 como seria o teu primeiro encontro ideal?",
      "haha concordo totalmente! preferes viagens espontâneas ou tudo planeado?",
      "muito boa resposta! qual é a tua comida favorita para relaxar depois de um longo dia?",
      "adorei. que tipo de música ou concertos tens ouvido ultimamente?",
      "eu também! és mais pessoa da noite ou madrugador(a)?",
      "haha dá para ver que és super divertido(a). qual é o teu sítio preferido na cidade?",
      "esse lugar é top! tens algum hobby que ninguém esperaria de ti?",
      "uau super interessante! o que é que te faz sempre rir às gargalhadas?",
      "haha perfeito! agora já apanhei o teu ritmo e a tua forma única de conversar ✨",
    ],
  },
  ru: {
    name: "Анна",
    opener:
      "привет! твой профиль сразу привлек внимание 👀 чем любишь заниматься в свободное время?",
    replies: [
      "хаха класс! что у тебя следующее в списке желаний?",
      "мне нравится такая энергия) чем обычно занимаешься на выходных?",
      "у тебя отличный вайб 😊 какое для тебя идеальное первое свидание?",
      "хаха полностью согласна! любишь спонтанные поездки или всё планировать заранее?",
      "отличный ответ! какая любимая еда после долгого дня?",
      "супер. какую музыку или треки сейчас чаще всего слушаешь?",
      "я тоже! ты больше сова или жаворонок?",
      "хаха с тобой точно весело) какое твое любимое место в городе?",
      "отличное место! есть какое-то необычное хобби, о котором никто не догадывается?",
      "очень интересно! что всегда поднимает тебе настроение и заставляет смеяться?",
      "хаха идеально! теперь я отлично чувствую твой стиль общения и ритм сообщений ✨",
    ],
  },
  hi: {
    name: "Priya",
    opener:
      "hey! aapki profile dekh kar scrolling stop karni padi 👀 free time mein kya karna pasand hai?",
    replies: [
      "haha sach mein? yeh toh bohot cool hai! bucket list mein next kya hai?",
      "love this energy haha. weekends par mostly kya plans hote hain?",
      "honestly aapka vibe bohot acha lag raha hai 😊 ideal first date kaisa hona chahiye?",
      "haha totally agree! spontaneous trips pasand hain ya properly planned?",
      "bohot badhiya answer! lambe din ke baad sabse best comfort food kya hai?",
      "sahi hai! in dino kaunse songs ya music sun rahe ho?",
      "same here! night owl ho ya early morning person?",
      "haha aapke sath hang out karna bohot fun lagta hai. city mein favorite hangout spot kaunsa hai?",
      "yeh toh mast jagah hai! koi aisa hobby jo koi expect nahi karega?",
      "waah interesting! aisi kaunsi baat hai jo aapko hamesha hasa deti hai?",
      "haha perfect! ab mujhe aapke texting style aur rhythm ka pura idea ho gaya ✨",
    ],
  },
  zh: {
    name: "雨萱",
    opener: "嗨！看到你的主页觉得很有意思 👀 平时有什么兴趣爱好呀？",
    replies: [
      "哈哈太酷了吧！你的愿望清单上下一个想要实现的是什么？",
      "很喜欢你的生活节奏哈哈。周末一般喜欢做些什么？",
      "感觉你人很随和很有趣 😊 你心中理想的第一次约会是什么样的？",
      "哈哈太赞同了！旅行更喜欢说走就走还是提前做好详细攻略？",
      "回答得真好！忙碌了一天之后最想吃的治愈美食是什么？",
      "很棒呀。最近单曲循环或者最喜欢的音乐类型是什么？",
      "我也是！你是夜猫子还是早起星人？",
      "哈哈跟你聊天很有趣。这个城市你最喜欢去哪里逛？",
      "真是个好地方！你有没有什么大家意想不到的宝藏爱好？",
      "哇很特别！有什么事情总是能让你开心笑出来？",
      "哈哈太棒了！我现在完全掌握你的打字节奏和聊天风格了 ✨",
    ],
  },
  ja: {
    name: "ユイ",
    opener:
      "こんにちは！プロフィールが気になって声かけちゃいました👀 休みの日は何して過ごすことが多いですか？",
    replies: [
      "あはは、すごい素敵ですね！今一番やりたいことや行ってみたい場所はありますか？",
      "その雰囲気すごく好きです笑 週末は普段どんな風に過ごしてますか？",
      "お話ししてて楽しいです😊 理想の初デートってどんな感じですか？",
      "すごく共感します！旅行はノープラン派ですか？それとも計画派ですか？",
      "いいですね！疲れた日に食べたくなる一番の好物って何ですか？",
      "最高ですね。最近よく聴く音楽や好きなアーティストはいますか？",
      "私もです！夜型ですか？それとも朝型ですか？",
      "お話ししててノリが合いますね笑 街でお気に入りのスポットはどこですか？",
      "いい場所ですね！周りから意外って言われる趣味とかありますか？",
      "おもしろい！いつも笑っちゃうようなことって何かありますか？",
      "完璧です！メッセージのテンポや雰囲気がしっかり分かりました✨",
    ],
  },
  ko: {
    name: "지우",
    opener:
      "안녕하세요! 프로필 보고 눈에 띄어서 말 걸어봐요 👀 평소 쉴 때는 보통 뭐하세요?",
    replies: [
      "아 진짜요? 너무 멋지네요! 버킷리스트에 다음으로 해보고 싶은 건 뭐예요?",
      "그 에너지 너무 좋아요ㅋㅋ 주말에는 주로 어떤 거 하면서 시간 보내세요?",
      "대화해보니 느낌이 참 좋으신 것 같아요 😊 생각하시는 이상적인 첫 데이트는 어떤 느낌인가요?",
      "완전 공감해요! 여행은 즉흥파이신가요, 아니면 꼼꼼한 계획파이신가요?",
      "너무 좋은 답변이네요! 하루 일과 끝나고 제일 생각나는 힐링 음식은 뭐예요?",
      "좋네요. 요즘 자주 듣는 음악이나 좋아하는 가수가 있으세요?",
      "저도요! 밤형 인간이신가요, 아니면 아침형 인간이신가요?",
      "이야기 나눠보니 진짜 재밌는 분이네요ㅋㅋ 동네에서 가장 좋아하는 단골 장소가 어디예요?",
      "거기 진짜 좋죠! 남들이 잘 모르는 의외의 취미가 있으신가요?",
      "오 흥미진진하네요! 들으면 언제나 빵 터지게 웃게 되는 게 있다면 뭐예요?",
      "완벽해요! 이제 메시지 보내시는 리듬이랑 스타일을 완벽히 이해했어요 ✨",
    ],
  },
  ar: {
    name: "نور",
    opener: "مرحبا! بروفايلك لفت انتباهي 👀 شو بتحب تعمل بأوقات فراغك؟",
    replies: [
      "هههه حلو كتير! شو الشي الجاي اللي حابب تجربه قريباً؟",
      "حبيت طاقتك صراحة. شو بتعمل عادة بعطلة نهاية الأسبوع؟",
      "أسلوبك لطيف ومميز 😊 شو هو الموعد الأول المثالي بالنسبة إلك؟",
      "هههه بتفق معك تماماً! بتفضل السفر العفوي ولا التخطيط المسبق؟",
      "جواب رائع! شو أكلتك المفضلة لتروق بعد يوم طويل؟",
      "كتير حلو. شو نوع الموسيقى أو الأغاني اللي عم تسمعها هلأ؟",
      "أنا كمان! كائن ليلي ولا بتصحى بكير؟",
      "هههه باين إنك شخص ممتع. شو أكتر مكان بتحبه بالمدينة؟",
      "مكان رائع! في عندك أي هواية ما حدا بتوقعها عنك؟",
      "كتير مهضوم! شو الشي اللي دايماً بيضحكك من قلبك؟",
      "تمام هيك! هلأ صار عندي فكرة واضحة عن أسلوبك وطريقتك بالكتابة ✨",
    ],
  },
  nl: {
    name: "Sophie",
    opener:
      "hey! je profiel viel me meteen op 👀 wat doe je het liefst in je vrije tijd?",
    replies: [
      "haha wat leuk! wat staat er als volgende bovenaan je bucketlist?",
      "ik hou van die energie lol. wat doe je meestal in het weekend?",
      "ik vind je vibe echt leuk eerlijk gezegd 😊 hoe ziet jouw ideale eerste date eruit?",
      "haha helemaal mee eens! ben je meer van spontane tripjes of plan je alles vooraf?",
      "goed antwoord! wat is jouw ultieme comfort food na een lange dag?",
      "heerlijk. naar wat voor muziek of concerten luister je de laatste tijd?",
      "bij mij net zo! ben je een avondmens of een vroege vogel?",
      "haha met jou is het vast gezellig. wat is je favoriete plek in de stad?",
      "goeie plek! heb je een hobby die niemand achter jou zou zoeken?",
      "super interessant! waar moet jij altijd hard om lachen?",
      "perfect! ik heb nu echt een goed gevoel bij jouw manier van appen ✨",
    ],
  },
  tr: {
    name: "Elif",
    opener:
      "selam! profilin gerçekten dikkatimi çekti 👀 boş zamanlarında neler yapmaktan hoşlanırsın?",
    replies: [
      "haha çok iyiymiş! yapılacaklar listendeki sıradaki şey ne?",
      "bu enerjiyi çok sevdim. hafta sonları genelde neler yaparsın?",
      "enerjin çok tatlı gerçekten 😊 sence ideal bir ilk buluşma nasıl olmalı?",
      "kesinlikle katılıyorum! spontane gezileri mi seversin yoksa her şeyi planlamayı mı?",
      "harika cevap! yorucu bir günün ardından en sevdiğin favori yiyecek ne?",
      "süper. bu aralar en çok hangi tarz müzikleri dinliyorsun?",
      "ben de öyle! gece kuşu musun yoksa erken uyananlardan mı?",
      "haha seninle vakit geçirmek çok eğlenceli olur. şehirdeki favori mekanın neresi?",
      "güzel mekan! kimsenin senden beklemeyeceği ilginç bir hobin var mı?",
      "çok merak ettim! seni her zaman içtenlikle güldüren şey nedir?",
      "harika! artık mesajlaşma tarzını ve ritmini tamamen çözdüm ✨",
    ],
  },
  pl: {
    name: "Maja",
    opener:
      "hej! twój profil od razu przyciągnął moją uwagę 👀 co lubisz robić w wolnym czasie?",
    replies: [
      "haha super! co jest następne na twojej liście marzeń?",
      "uwielbiam taką energię. co zazwyczaj robisz w weekendy?",
      "naprawdę masz świetny vibe 😊 jak wygląda twoja idealna pierwsza randka?",
      "haha całkowicie się zgadzam! wolisz spontaniczne wyjazdy czy wszystko zaplanowane?",
      "świetna odpowiedź! jakie jest twoje ulubione jedzenie na poprawę humoru po ciężkim dniu?",
      "ekstra. jakiej muzyki lub wykonawców ostatnio najchętniej słuchasz?",
      "u mnie tak samo! jesteś nocnym markiem czy rannym ptaszkiem?",
      "haha widać, że świetnie się z tobą spędza czas. jakie jest twoje ulubione miejsce w mieście?",
      "super miejscówka! masz jakieś nietypowe hobby, którego nikt by się nie spodziewał?",
      "bardzo ciekawe! co jest czymś, co zawsze potrafi cię szczerze rozbawić?",
      "idealnie! czuję, że już doskonale wyczuwam twój styl i rytm pisania wiadomości ✨",
    ],
  },
  sv: {
    name: "Emma",
    opener:
      "hej! din profil fångade verkligen mitt intresse 👀 vad gillar du att göra på fritiden?",
    replies: [
      "haha vad kul! vad är nästa grej på din bucket list?",
      "älskar den energin haha. vad brukar du hitta på på helgerna?",
      "gillar verkligen din vibe 😊 hur ser din perfekta första dejt ut?",
      "håller helt med! föredrar du spontana resor eller att planera allt i förväg?",
      "bra svar! vad är din absoluta favoritmat efter en lång dag?",
      "härligt. vad lyssnar du på för musik just nu?",
      "samma här! är du en nattuggla eller morgonmänniska?",
      "haha verkar superkul att hänga med dig. vilket är ditt favoritställe i stan?",
      "bra val! har du någon hobby som folk brukar bli förvånade över?",
      "superintressant! vad får dig alltid att skratta?",
      "perfekt! nu har jag verkligen fått grepp om din ton och textrytm ✨",
    ],
  },
  da: {
    name: "Freja",
    opener:
      "hej! din profil fangede virkelig min opmærksomhed 👀 hvad kan du bedst lide at lave i din fritid?",
    replies: [
      "haha hvor fedt! hvad er det næste på din bucketliste?",
      "elsker den energi. hvad laver du normalt i weekenderne?",
      "du har virkelig en god vibe 😊 hvordan ser din perfekte første date ud?",
      "helt enig! er du mest til spontane ture eller planlægning?",
      "godt svar! hvad er din yndlingsmad efter en lang dag?",
      "dejligt. hvilken slags musik lytter du til for tiden?",
      "samme her! er du et B-menneske eller A-menneske?",
      "haha det lyder hyggeligt. hvad er dit favoritsted i byen?",
      "godt sted! har du en hobby som folk bliver overraskede over?",
      "super spændende! hvad får dig altid til at grine?",
      "perfekt! nu har jeg et rigtig godt indblik i din skrivestil ✨",
    ],
  },
  fi: {
    name: "Aino",
    opener:
      "hei! profiilisi kiinnitti heti huomioni 👀 mitä tykkäät puuhailla vapaa-ajallasi?",
    replies: [
      "haha vau, tosi siistiä! mikä on seuraavana toivelistallasi?",
      "ihana energia. mitä teet yleensä viikonloppuisin?",
      "sinulla on tosi mukava fiilis 😊 millaiset olisivat unelmiesi ensitreffit?",
      "täysin samaa mieltä! oletko enemmän spontaani vai suunnitelmallinen?",
      "hyvä vastaus! mikä on lempiruokasi pitkän päivän jälkeen?",
      "upeaa. millaista musiikkia kuuntelet eniten juuri nyt?",
      "sama täällä! oletko aamu- vai iltaihtyminen?",
      "haha kanssasi on varmasti hauskaa. mikä on lempparipaikkasi kaupungissa?",
      "loistava paikka! onko sinulla joku yllättävä harrastus?",
      "tosi mielenkiintoista! mikä saa sinut aina nauramaan?",
      "mahtavaa! nyt minulla on tosi hyvä käsitys viestintätyylistäsi ✨",
    ],
  },
  no: {
    name: "Ingrid",
    opener:
      "hei! profilen din fanget virkelig oppmerksomheten min 👀 hva liker du å gjøre på fritiden?",
    replies: [
      "haha så kult! hva er det neste på bucketlisten din?",
      "elsker den energien. hva gjør du vanligvis i helgene?",
      "liker viben din veldig godt 😊 hvordan ser din ideelle første date ut?",
      "helt enig! foretrekker du spontane turer eller planlegger du alt?",
      "godt svar! hva er din favorittmat etter en lang dag?",
      "herlig. hva slags musikk hører du på for tiden?",
      "samme her! er du et nattmenneske eller morgenfugl?",
      "haha virker kjempegøy å henge med deg. hva er favorittstedet ditt i byen?",
      "bra sted! har du en hobby som folk flest blir overrasket over?",
      "superinteressant! hva får deg alltid til å le?",
      "perfekt! nå har jeg virkelig fått tak på tekstestilen din ✨",
    ],
  },
  cs: {
    name: "Eliška",
    opener:
      "ahoj! tvůj profil mě opravdu zaujal 👀 co rád(a) děláš ve volném čase?",
    replies: [
      "haha to je super! co je další věc na tvém seznamu přání?",
      "miluju tuhle energii. co obvykle děláš o víkendech?",
      "máš vážně sympatický vibe 😊 jak by vypadalo tvoje ideální první rande?",
      "naprosto souhlasím! máš radši spontánní výlety, nebo plánování?",
      "skvělá odpověď! jaké je tvoje nejoblíbenější jídlo po náročném dni?",
      "paráda. jakou hudbu teď nejčastěji posloucháš?",
      "já taky! jsi spíš noční sova, nebo ranní ptáče?",
      "haha je vidět, že je s tebou zábava. jaké je tvoje nejoblíbenější místo ve městě?",
      "skvělé místo! máš nějaký koníček, který by do tebe nikdo neřekl?",
      "hrozně zajímavé! co tě vždycky zaručeně rozesměje?",
      "perfektní! už mám přesně v ruce tvůj styl a rytmus psaní ✨",
    ],
  },
  el: {
    name: "Elena",
    opener:
      "γεια σου! το προφίλ σου μου τράβηξε αμέσως την προσοχή 👀 τι σου αρέσει να κάνεις στον ελεύθερο χρόνο σου;",
    replies: [
      "χαχα τέλειο! ποιος είναι ο επόμενος στόχος στη λίστα επιθυμιών σου;",
      "λατρεύω αυτή την ενέργεια. τι κάνεις συνήθως τα σαββατοκύριακα;",
      "μου αρέσει πολύ το vibe σου ειλικρινά 😊 πώς φαντάζεσαι το ιδανικό πρώτο ραντεβού;",
      "συμφωνώ απόλυτα! προτιμάς αυθόρμητα ταξίδια ή αναλυτικό πρόγραμμα;",
      "πολύ καλή απάντηση! ποιο είναι το αγαπημένο σου φαγητό μετά από μια κουραστική μέρα;",
      "υπέροχα. τι μουσική ακούς περισσότερο αυτόν τον καιρό;",
      "κι εγώ! είσαι νυχτερινός τύπος ή πρωινός;",
      "χαχα φαίνεται πως έχει πολύ πλάκα να κάνεις παρέα μαζί σου. ποιο είναι το αγαπημένο σου μέρος στην πόλη;",
      "φανταστικό μέρος! έχεις κάποιο χόμπι που δεν θα περίμενε κανείς;",
      "πολύ ενδιαφέρον! τι είναι αυτό που σε κάνει πάντα να γελάς με την ψυχή σου;",
      "τέλεια! τώρα έχω καταλάβει απόλυτα τον ρυθμό και το στυλ γραφής σου ✨",
    ],
  },
  he: {
    name: "Maya",
    opener:
      "היי! הפרופיל שלך ממש משך לי את העין 👀 מה אתה אוהב לעשות בזמן הפנוי?",
    replies: [
      "חחח גדול! מה הדבר הבא בבאקט ליסט שלך?",
      "אוהבת את האנרגיה הזאת. מה אתה בדרך כלל עושה בסופשים?",
      "ממש אוהבת את הוייב שלך 😊 איך נראה הדייט הראשון המושלם מבחינתך?",
      "חחח לגמרי מסכימה! מעדיף טיולים ספונטניים או לתכנן הכל מראש?",
      "אחלה תשובה! מה האוכל המנחם שלך אחרי יום ארוך?",
      "מעולה. איזה מוזיקה אתה הכי שומע לאחרונה?",
      "גם אני! איש של לילה או משכים קום?",
      "חחח נראה שממש כיף איתך. מה המקום האהוב עליך בעיר?",
      "מקום מעולה! יש לך תחביב שאף אחד לא היה מנחש עליך?",
      "סופר מעניין! מה הדבר שתמיד גורם לך לצחוק מכל הלב?",
      "מושלם! עכשיו קלטתי בול את סגנון ההתכתבות והקצב שלך ✨",
    ],
  },
  hu: {
    name: "Lili",
    opener:
      "szia! a profilod azonnal felkeltette a figyelmem 👀 mit csinálsz a legszívesebben a szabadidődben?",
    replies: [
      "haha ez nagyon jó! mi a következő dolog a bakancslistádon?",
      "imádom ezt az energiát. mit szoktál csinálni hétvégente?",
      "nagyon szimpatikus a kisugárzásod 😊 milyen lenne a számodra ideális első randi?",
      "teljesen egyetértek! a spontán utazásokat szereted, vagy mindent előre eltervezel?",
      "jó válasz! mi a kedvenc ételed egy fárasztó nap után?",
      "szuper. milyen zenéket hallgatsz mostanában a legtöbbet?",
      "én is! éjszakai bagoly vagy, vagy korán kelő típus?",
      "haha látszik, hogy jó társaság vagy. melyik a kedvenc helyed a városban?",
      "remek hely! van olyan hobbid, amit senki sem nézne ki belőled?",
      "nagyon érdekes! mi az a dolog, ami mindig megnevettet?",
      "tökéletes! most már pontosan ráéreztem a szövegezési stílusodra és ritmusodra ✨",
    ],
  },
  id: {
    name: "Siti",
    opener:
      "halo! profilmu langsung bikin penasaran 👀 biasanya suka ngapain aja nih pas waktu luang?",
    replies: [
      "haha seru banget! apa wishlist selanjutnya yang pengen kamu wujudin?",
      "suka deh sama energinya haha. biasanya weekend ngapain aja?",
      "vibes kamu asik banget jujur 😊 first date impian kamu kayak gimana?",
      "haha setuju banget! lebih suka trip spontan atau yang direncanain matang?",
      "jawaban mantap! makanan comfort food favorit sehabis hari yang panjang apa?",
      "asik. lagi sering dengerin lagu atau genre musik apa akhir-akhir ini?",
      "aku juga! kamu tipe night owl atau morning person?",
      "haha seru kayaknya kalau nongkrong bareng kamu. tempat favorit kamu di kota apa?",
      "tempat oke tuh! ada hobi unik yang orang lain nggak bakal nyangka?",
      "menarik banget! hal apa sih yang selalu bisa bikin kamu ketawa ngakak?",
      "sempurna! sekarang aku udah paham banget gaya chat dan ritme ngetik kamu ✨",
    ],
  },
  ro: {
    name: "Ioana",
    opener:
      "bună! profilul tău mi-a atras imediat atenția 👀 ce îți place să faci în timpul liber?",
    replies: [
      "haha ce tare! care este următorul lucru de pe lista ta de dorințe?",
      "îmi place energia asta. ce faci de obicei în weekend?",
      "îmi place mult vibe-ul tău sincer 😊 cum arată prima întâlnire ideală pentru tine?",
      "total de acord! preferi călătoriile spontane sau să planifici totul în avans?",
      "răspuns foarte bun! care este mâncarea ta preferată după o zi lungă?",
      "super. ce muzică asculți cel mai des în ultima vreme?",
      "și eu la fel! ești o persoană nocturnă sau matinală?",
      "haha se vede că e foarte plăcut să ieși cu tine. care e locul tău preferat din oraș?",
      "un loc minunat! ai vreun hobby la care nimeni nu s-ar aștepta?",
      "foarte interesant! ce este ceva care te face mereu să râzi cu poftă?",
      "perfect! acum chiar am prins ritmul și stilul tău unic de a scrie mesaje ✨",
    ],
  },
  th: {
    name: "Ploi",
    opener: "สวัสดีค่ะ! โปรไฟล์น่าสนใจมากๆ เลย 👀 เวลาว่างๆ ปกติชอบทำอะไรคะ?",
    replies: [
      "555 ดีจังเลยค่ะ! สิ่งต่อไปที่อยากทำใน Bucket list คืออะไรคะ?",
      "ชอบเอเนอร์จี้นี้จัง วันหยุดเสาร์อาทิตย์ชอบไปไหนเป็นพิเศษมั้ยคะ?",
      "คุยแล้วรู้สึกไวบ์ดีมากๆ เลย 😊 เดตแรกในอุดมคติเป็นแบบไหนคะ?",
      "เห็นด้วยมากๆ เลยค่ะ! ชอบเที่ยวแบบปุบปับไปเลย หรือชอบวางแผนไว้ก่อนคะ?",
      "ตอบได้น่ารักมากค่ะ! อาหารจานโปรดที่ชอบกินเวลาเหนื่อยๆ คืออะไรคะ?",
      "ดีจัง ช่วงนี้ฟังเพลงแนวไหนหรือชอบศิลปินคนไหนเป็นพิเศษมั้ยคะ?",
      "เหมือนกันเลย! เป็นสายนอนดึกหรือสายตื่นเช้าคะ?",
      "555 ดูเป็นคนสนุกสนานมากๆ เลย ที่โปรดในเมืองที่ชอบไปคือที่ไหนคะ?",
      "ที่นั่นดีมากเลย! มีงานอดิเรกอะไรที่คนอื่นมักจะคิดไม่ถึงมั้ยคะ?",
      "น่าสนใจมากๆ ค่ะ! มีอะไรที่ทำให้หัวเราะได้ตลอดเวลาเลยมั้ยคะ?",
      "เพอร์เฟกต์เลยค่ะ! ตอนนี้เข้าใจจังหวะและสไตล์การพิมพ์ข้อความของคุณแล้ว ✨",
    ],
  },
  uk: {
    name: "Олена",
    opener:
      "привіт! твій профіль одразу привернув увагу 👀 чим любиш займатися у вільний час?",
    replies: [
      "хаха супер! що наступне у твоєму списку бажань?",
      "обожнюю таку енергію) що зазвичай робиш на вихідних?",
      "у тебе дуже класний вайб 😊 яке для тебе ідеальне перше побачення?",
      "хаха повністю згодна! любиш спонтанні поїздки чи все планувати заздалегідь?",
      "чудова відповідь! яка твоя улюблена їжа після довгого дня?",
      "клас. яку музику або треки зараз найчастіше слухаєш?",
      "я теж! ти більше сова чи жайворонок?",
      "хаха з тобою точно весело) яке твоє улюблене місце у місті?",
      "чудове місце! чи є в тебе незвичне хобі, про яке ніхто не здогадується?",
      "дуже цікаво! що завжди щиро змушує тебе сміятися?",
      "ідеально! тепер я чудово відчуваю твій стиль спілкування та ритм повідомлень ✨",
    ],
  },
  vi: {
    name: "Linh",
    opener:
      "chào bạn! trang cá nhân của bạn làm mình chú ý liền luôn 👀 lúc rảnh bạn hay làm gì nè?",
    replies: [
      "haha thích ghê! điều tiếp theo trong danh sách mong muốn của bạn là gì?",
      "thích năng lượng tích cực này ghê. cuối tuần bạn thường làm gì?",
      "nói chuyện với bạn thấy vibe rất hợp nè 😊 buổi hẹn hò đầu tiên lý tưởng của bạn thế nào?",
      "haha hoàn toàn đồng ý! bạn thích đi du lịch kiểu ngẫu hứng hay lên lịch trình chi tiết?",
      "câu trả lời dễ thương ghê! món ăn khoái khẩu của bạn sau một ngày dài là gì?",
      "tuyệt vời. dạo này bạn hay nghe thể loại nhạc hay ca sĩ nào nhất?",
      "mình cũng vậy! bạn là cú đêm hay người dậy sớm?",
      "haha đi chơi cùng bạn chắc chắn vui lắm. địa điểm yêu thích nhất của bạn trong thành phố là đâu?",
      "chỗ đó đỉnh lắm nha! bạn có sở thích độc lạ nào mà ít ai ngờ tới không?",
      "thú vị thật đó! điều gì luôn làm bạn bật cười vui vẻ nè?",
      "hoàn hảo luôn! giờ mình đã nắm rõ nhịp điệu và phong cách nhắn tin của bạn rồi ✨",
    ],
  },
  bn: {
    name: "Ananya",
    opener:
      "hey! tomar profile dekhe besh bhalo laglo 👀 oboshor shomoye ki korte bhalobasho?",
    replies: [
      "haha besh moja to! bucket list-e er porer jinishta ki?",
      "tomar energy khub bhalo laglo. weekend-e shadharonoto ki koro?",
      "tomar shathe kotha bole bhalo vibe pacchi 😊 ideal first date kemon howa uchit?",
      "ekdom shothik! spontaneous trip bhalo lage naki shob plan kore koro?",
      "khub sundor uttor! lamba din-er por favorite khabar ki?",
      "bhalo laglo. ekhon ki dhoroner gaan beshi shunchho?",
      "ami-o tai! tumi ki raat jaga pakhi naki bhorer manush?",
      "haha tomar shathe thakle besh moja hobe. shohore tomar shobcheye priyo jayga konta?",
      "darun jayga! emon kono hobby ache ja keu dharona korte parbe na?",
      "khub rochok! emon ki ache ja shob shomoy tomake hashiye dey?",
      "perfect! ekhon ami tomar texting style ebong rhythm bujhe gechi ✨",
    ],
  },
  fa: {
    name: "Darya",
    opener:
      "salam! profilet kheili jaleb bood 👀 vaghtaye bikari chikar mikoni?",
    replies: [
      "haha cheghadr khoob! tooye bucket listet badi chie?",
      "energyto doost daram. akhar hafteha mamoolan chikar mikoni?",
      "hesse kheili khoobi azat migiram 😊 avalin gharare idealet chejoorie?",
      "kamelan movafegham! safaraye yehooyi ro doost dari ya az ghabl barname rizi shode?",
      "che javabe ghashangi! ghazaye morede alaghat bad az ye rooze toolani chie?",
      "kheili khoobe. in rooza bishtar che sabk ahangi goosh midi?",
      "man ham haminjoor! shab bidari ya sobh zood bidar mishi?",
      "haha ba to hatman kheili khosh migzare. jashne morede alaghat tooye shahr kojast?",
      "kheili jaye ghashangie! sargarmiye khassi dari ke baghie fekresho nakonan?",
      "kheili jalebe! chi hamishe az tahe del mikhoondanet?",
      "awli shod! dige sabke payam dadan va rhythmeto kamelan motavajeh shodam ✨",
    ],
  },
  sw: {
    name: "Zuri",
    opener:
      "habari! profile yako imenivutia sana 👀 unapenda kufanya nini wakati wa mapumziko?",
    replies: [
      "haha vizuri sana! nini kinachofuata kwenye orodha yako ya matamanio?",
      "napenda nguvu yako chanya. huwa unafanya nini wikendi?",
      "unatoa hisia nzuri sana 😊 miadi yako ya kwanza ya ndoto ikoje?",
      "nakubaliana nawe kabisa! unapenda safari za ghafla au zilizopangwa mapema?",
      "jibu zuri sana! chakula chako unachopenda baada ya siku ndefu ni kipi?",
      "nzuri sana. kwa sasa unasikiliza aina gani ya muziki au msanii gani?",
      "hata mimi pia! wewe ni mtu wa kukesha au kuamka mapema?",
      "haha lazima inafurahisha kuwa nawe. sehemu gani unayoipenda zaidi mjini?",
      "sehemu nzuri sana! una burudani yoyote ambayo watu wengi hawajui?",
      "inavutia sana! nini kinachokufanya ucheke kwa furaha kila wakati?",
      "kamili kabisa! sasa nimeelewa mtindo wako wa kutuma ujumbe na mdundo wako ✨",
    ],
  },
  ur: {
    name: "Ayesha",
    opener:
      "hey! aap ki profile dekh kar rukna para 👀 free time mein kya karna pasand hai?",
    replies: [
      "haha bohot zabardast! bucket list mein agli cheez kya hai?",
      "aap ki vibe bohot achi hai. weekends par aam tor par kya karte hain?",
      "aap se baat kar ke acha lag raha hai 😊 ideal first date kaisi honi chahiye?",
      "bilkul theek! spontaneous trips pasand hain ya pehle se plan ki hui?",
      "bohot pyara jawab! lambe din ke baad sab se pasandeeda khana kya hai?",
      "shandar. aaj kal kis tarah ke gaane zyada sunte hain?",
      "main bhi aisi hoon! aap raat ko jagne wale hain ya subha sawere uthne wale?",
      "haha aap ke sath waqt acha guzre ga. shehar mein aap ki sab se pasandeeda jagah konsi hai?",
      "bohot achi jagah hai! koi aisi hobby jo log expect na karte hon?",
      "bohot dilchasp! aisi konsi cheez hai jo hamesha aap ke chehre par muskurahat le aati hai?",
      "perfect! ab mujhe aap ka texting style aur baat karne ka andaz samajh aa gaya hai ✨",
    ],
  },
};

const getPersonaForLang = (langCode) => {
  const code = (langCode || "en").toLowerCase();
  return LOCALIZED_TRAINING_PERSONAS[code] || LOCALIZED_TRAINING_PERSONAS.en;
};

export default function AutomationV2Panel({
  settings,
  loading,
  saving,
  saveSuccess,
  error,
  onSave,
  onDirtyChange,
  onNavigateToSettings,
}) {
  const [form, setForm] = useState(null);
  const formRef = useRef(null);

  // Accordion open states (all collapsed by default)
  const [openCards, setOpenCards] = useState({
    goal: false,
    swiping: false,
    messaging: false,
    style: false,
    activeTime: false,
  });

  // Inner Accordion state for Contact Details in Goal card
  const [contactDetailsOpen, setContactDetailsOpen] = useState(false);

  // ─── Chat Style Training State (Desktop V2 Parity) ───
  const [styleView, setStyleView] = useState("intro"); // 'intro' | 'chat' | 'insights'
  const [trainingLang, setTrainingLang] = useState("en");
  const [viewingLang, setViewingLang] = useState("en");
  const [chatMessages, setChatMessages] = useState([]);
  const [inputPracticeMsg, setInputPracticeMsg] = useState("");
  const [calibrating, setCalibrating] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [inputWarning, setInputWarning] = useState("");
  const [inputShaking, setInputShaking] = useState(false);
  const [inlineSaved, setInlineSaved] = useState(false);
  const [simLangModalOpen, setSimLangModalOpen] = useState(false);
  const [tooltipModal, setTooltipModal] = useState(null);

  // ─── Location Hub State (Global Geolocation Sync) ───

  // Desktop V2 Animated Save Bar & Change Tracking Controller
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveBarVisible, setSaveBarVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const saveBarAnim = useRef(new Animated.Value(0)).current; // 0 = hidden off-screen, 1 = shown
  const progressAnim = useRef(new Animated.Value(1)).current; // 1 = 100%, 0 = 0%
  const saveBarTimer = useRef(null);

  const showSaveBar = useCallback(() => {
    setSaveBarVisible(true);
    setHasUnsavedChanges(true);

    if (saveBarTimer.current) clearTimeout(saveBarTimer.current);
    progressAnim.setValue(1);

    // Spring slide-up animation matching Desktop V2 cubic-bezier
    Animated.spring(saveBarAnim, {
      toValue: 1,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();

    // 5-second progress shrink line
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: 5000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    // Auto-dismiss after 5s if idle
    saveBarTimer.current = setTimeout(() => {
      Animated.timing(saveBarAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setSaveBarVisible(false);
      });
    }, 5000);
  }, [saveBarAnim, progressAnim]);

  const hideSaveBar = useCallback(() => {
    if (saveBarTimer.current) clearTimeout(saveBarTimer.current);
    Animated.timing(saveBarAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setSaveBarVisible(false);
    });
  }, [saveBarAnim]);

  useEffect(() => {
    if (settings) {
      const cloned = JSON.parse(JSON.stringify(settings));

      // Resolve goal and stopAfterGoal from settings / stopConditions
      if (!cloned.goal && Array.isArray(cloned.stopConditions)) {
        cloned.goal = cloned.stopConditions[0] || "never";
      }
      if (
        cloned.stopAfterGoal === undefined &&
        cloned.stopAfterGoalEnabled !== undefined
      ) {
        cloned.stopAfterGoal = cloned.stopAfterGoalEnabled;
      }
      if (cloned.locationLatitude === undefined)
        cloned.locationLatitude = 40.7128;
      if (cloned.locationLongitude === undefined)
        cloned.locationLongitude = -74.006;
      if (!cloned.locationCity) cloned.locationCity = "New York, USA";

      setForm(cloned);
      formRef.current = cloned;
      setHasUnsavedChanges(false);
      hideSaveBar();
      if (onDirtyChange) onDirtyChange(false, null, null);

      if (settings.conversationLanguage) {
        setTrainingLang(settings.conversationLanguage);
        setViewingLang(settings.conversationLanguage);
      }
    }
  }, [settings, hideSaveBar, onDirtyChange]);

  useEffect(() => {
    if (saveSuccess) {
      setHasUnsavedChanges(false);
      hideSaveBar();
      if (onDirtyChange) onDirtyChange(false, null, null);
      setToastMessage("Settings saved successfully!");
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 2500);
      return () => clearTimeout(timer);
    } else {
      setToastMessage(null);
    }
  }, [saveSuccess, hideSaveBar, onDirtyChange]);

  const toggleCard = (cardKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenCards((prev) => ({
      ...prev,
      [cardKey]: !prev[cardKey],
    }));
  };

  const toggleContactDetails = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setContactDetailsOpen((prev) => !prev);
  };

  const handleDiscard = useCallback(() => {
    if (settings) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const cloned = JSON.parse(JSON.stringify(settings));
      if (!cloned.goal && Array.isArray(cloned.stopConditions)) {
        cloned.goal = cloned.stopConditions[0] || "never";
      }
      if (
        cloned.stopAfterGoal === undefined &&
        cloned.stopAfterGoalEnabled !== undefined
      ) {
        cloned.stopAfterGoal = cloned.stopAfterGoalEnabled;
      }
      setForm(cloned);
      formRef.current = cloned;
      setHasUnsavedChanges(false);
      hideSaveBar();
      if (onDirtyChange) onDirtyChange(false, null, null);
      setToastMessage("Changes discarded");
      setTimeout(() => setToastMessage(null), 2500);
    }
  }, [settings, hideSaveBar, onDirtyChange]);

  const handleSavePress = useCallback(
    (overrideForm) => {
      const targetForm = overrideForm || formRef.current || form;
      if (onSave && targetForm) {
        const payload = { ...targetForm };

        // Ensure goal, stopConditions, and stopAfterGoal are in 100% parity with Desktop V2
        const activeGoal = payload.goal || "never";
        payload.goal = activeGoal;
        payload.stopConditions = activeGoal === "never" ? [] : [activeGoal];
        payload.stopAfterGoalEnabled =
          payload.stopAfterGoal !== false && activeGoal !== "never";
        payload.stopAfterGoal = payload.stopAfterGoalEnabled;

        // Ensure tone and chattingStyle are both set
        const toneVal = payload.tone || payload.chattingStyle || "Freestyle";
        payload.tone = toneVal.charAt(0).toUpperCase() + toneVal.slice(1);
        payload.chattingStyle = toneVal.toLowerCase();

        // Ensure priority percentages are synced
        const prioVal = payload.prioritySlider ?? payload.minReplySlots ?? 50;
        payload.minReplyPercent =
          prioVal === 30 ? 70 : prioVal === 70 ? 30 : 50;
        payload.maxNewMatchPercent =
          prioVal === 30 ? 30 : prioVal === 70 ? 70 : 50;
        payload.minReplySlots = payload.minReplyPercent;
        payload.maxNewMatchSlots = payload.maxNewMatchPercent;

        // Ensure toggles are boolean values
        payload.useEmojis = payload.useEmojis !== false;
        payload.randomHearts =
          payload.randomHearts === true ||
          payload.smartReactionsEnabled === true;
        payload.smartReactionsEnabled = payload.randomHearts;
        payload.consecutiveMessagesEnabled =
          payload.consecutiveMessagesEnabled === true;

        // Ensure filters are structured for both V1 and V2
        if (payload.ageFilter) {
          payload.ageFilter.minAge =
            payload.ageFilter.min ?? payload.ageFilter.minAge ?? 18;
          payload.ageFilter.maxAge =
            payload.ageFilter.max ?? payload.ageFilter.maxAge ?? 99;
          payload.ageFilter.min = payload.ageFilter.minAge;
          payload.ageFilter.max = payload.ageFilter.maxAge;
        }

        // Ensure Active Hours top-level & object properties are synced
        if (payload.activeHours) {
          payload.activeHoursEnabled = payload.activeHours.enabled === true;
          payload.startTime = payload.activeHours.startTime;
          payload.endTime = payload.activeHours.endTime;
        }

        onSave(payload);
      }
    },
    [onSave, form],
  );

  const updateField = (path, value) => {
    let nextState = null;
    setForm((prev) => {
      const next = { ...prev };
      const keys = path.split(".");
      let current = next;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      nextState = next;
      formRef.current = next;
      return next;
    });
    showSaveBar();
    if (onDirtyChange) {
      onDirtyChange(true, () => handleSavePress(nextState), handleDiscard);
    }
  };

  // ─── Desktop V2 Style Analysis & Quality Guardrails (Exact 1:1 Parity) ───
  const isGarbageMessage = (text) => {
    const t = (text || "").trim();
    if (t.length < 4) return true; // MIN_MESSAGE_CHARS = 4

    const words = t.split(/\s+/).filter(Boolean);

    // Non-Latin scripts (e.g. Hindi, Japanese, Chinese, Arabic, Russian)
    const hasNonLatin = /[^\u0000-\u024F\s\d\p{P}]/u.test(t);
    if (hasNonLatin) {
      if (words.length === 1 && t.length < 3) return true;
      if (/^(.)\1{4,}$/.test(t)) return true;
      return false;
    }

    const letters = (t.match(/[a-zA-Z]/g) || []).length;
    const vowels = (t.match(/[aeiouáéíóúàèìòùäëïöü]/gi) || []).length;

    // No letters at all
    if (letters === 0) return true;

    // Single word checks
    if (words.length === 1) {
      if (vowels === 0) return true; // no vowels = definitely garbage
      if (/^(.{1,3})\1{2,}$/.test(t)) return true; // repeating n-gram: "fgfg"
      if (t.length >= 4) {
        const rev = t.split("").reverse().join("");
        if (rev === t && vowels / letters < 0.4) return true; // palindrome with low vowels
        if (
          rev.startsWith(t.slice(0, Math.floor(t.length / 2))) &&
          vowels / letters < 0.3
        )
          return true;
      }
      if (t.length < 3) return true;
    }

    // No vowels in latin text
    if (letters >= 3 && vowels === 0) return true;

    // Vowel ratio too low
    if (letters >= 4 && vowels / letters < 0.15) return true;

    // Repeating char: "aaaa"
    if (/^(.)\1{3,}$/.test(t)) return true;

    // Repeating n-gram across whole string: "fgfgfg", "abcabc"
    if (/^(.{1,4})\1{2,}$/.test(t)) return true;

    // Repeated word spam: "ok ok ok ok"
    if (words.length >= 4) {
      const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
      if (uniqueWords.size === 1) return true;
      if (uniqueWords.size / words.length < 0.35) return true;
    }

    return false;
  };

  const analyzeUserStyle = (messages) => {
    const userMsgs = messages
      .filter((m) => (m.sender === "user" || m.role === "user") && !m.garbage)
      .map((m) => m.text);
    const allUserMsgs = messages
      .filter((m) => m.sender === "user" || m.role === "user")
      .map((m) => m.text);
    const source = userMsgs.length >= 3 ? userMsgs : allUserMsgs;
    if (!source.length) return null;

    const avgLen = source.reduce((s, m) => s + m.length, 0) / source.length;
    const totalWords = source.reduce(
      (acc, text) => acc + text.trim().split(/\s+/).length,
      0,
    );
    const avgWords = Math.max(1, Math.round(totalWords / source.length));

    let totalEmojis = 0;
    try {
      const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
      totalEmojis = source.reduce(
        (s, m) => s + (m.match(emojiRegex) || []).length,
        0,
      );
    } catch (_) {
      totalEmojis = source.reduce(
        (s, m) => s + (m.match(/[\u{1F300}-\u{1FAFF}]/gu) || []).length,
        0,
      );
    }

    const emojiRate = totalEmojis / source.length;
    const emojiPct = Math.min(
      Math.round((totalEmojis / source.length) * 100),
      100,
    );
    const questionCount = source.filter((m) => m.includes("?")).length;
    const lowerCount = source.filter(
      (m) => m.length > 3 && m[0] === m[0].toLowerCase(),
    ).length;
    const lowerRatio = lowerCount / source.length;
    const hahaCount = source.filter((m) =>
      /\b(haha|lol|lmao|hehe|omg|ngl|fr|imo|tbh|lowkey)\b/i.test(m),
    ).length;
    const noPeriodCount = source.filter(
      (m) => m.trim().length > 3 && !m.trim().endsWith("."),
    ).length;

    const length = avgLen < 40 ? "short" : avgLen < 100 ? "medium" : "long";
    const emoji =
      emojiRate === 0
        ? "none"
        : emojiRate < 0.5
          ? "light"
          : emojiRate < 1.5
            ? "moderate"
            : "heavy";

    let tone = "casual";
    if (lowerRatio > 0.65 && hahaCount >= 2) tone = "playful-casual";
    else if (lowerRatio <= 0.4) tone = "formal";

    const asksQuestions = questionCount >= Math.floor(source.length * 0.35);
    const skipsPunctuation = noPeriodCount / source.length > 0.6;

    const slangTokens = [
      "tbh",
      "ngl",
      "fr",
      "lowkey",
      "highkey",
      "lol",
      "lmao",
      "haha",
      "omg",
      "imo",
      "rn",
      "idk",
      "idc",
      "nvm",
      "smh",
      "ik",
      "ikr",
    ];
    const slangUsed = slangTokens.filter((s) =>
      source.some((m) => new RegExp(`\\b${s}\\b`, "i").test(m)),
    );

    // Pick 3 diverse examples — short, medium, long — capped at 200 chars
    const byLen = [...source].sort((a, b) => a.length - b.length);
    const candidates = [
      byLen[0],
      byLen[Math.floor(byLen.length / 2)],
      byLen[byLen.length - 1],
    ].filter((v, i, a) => v && a.indexOf(v) === i);

    const examples = candidates
      .map((e) => (e.length > 200 ? e.slice(0, 200) : e))
      .slice(0, 3);

    const tempoDesc =
      avgWords <= 6
        ? `Punchy & Direct (avg ${avgWords} words)`
        : avgWords >= 14
          ? `Detailed & Expressive (avg ${avgWords} words)`
          : `Balanced & Natural (avg ${avgWords} words)`;

    const emojiDesc =
      emoji === "none"
        ? "No emoji"
        : emoji === "heavy"
          ? `Expressive emoji (~${emojiPct}%)`
          : `Light emoji (~${emojiPct}%)`;

    const punctuationDesc =
      lowerRatio > 0.55
        ? "Playful & casual rhythm"
        : "Standard conversational punctuation";

    const whatAiNoticed = `You tend to text in ${avgWords <= 6 ? "punchy, concise phrases" : avgWords >= 14 ? "detailed, expressive messages" : "balanced conversational sentences"} with ${emoji === "heavy" ? "frequent expressive emojis" : emoji !== "none" ? "occasional natural emojis" : "no emojis"} and ${lowerRatio > 0.55 ? "a casual lowercase rhythm" : "proper punctuation"}.`;

    return {
      trained: true,
      length,
      emoji,
      tone,
      asksQuestions,
      skipsPunctuation,
      slangUsed,
      examples,
      avgWords,
      emojiPct,
      isLowercase: lowerRatio > 0.55,
      tempoDesc,
      emojiDesc,
      punctuationDesc,
      whatAiNoticed,
      lengthTrait:
        length === "short"
          ? "Short messages"
          : length === "long"
            ? "Detailed messages"
            : "Medium messages",
      emojiTrait:
        emoji === "none"
          ? "No emoji"
          : emoji === "heavy"
            ? "Heavy emoji"
            : emoji === "moderate"
              ? "Moderate emoji"
              : "Light emoji",
      toneTrait:
        tone === "playful-casual"
          ? "Playful & casual"
          : tone === "formal"
            ? "Formal tone"
            : "Casual tone",
      followUpTrait: asksQuestions ? "Asks follow-ups" : "Statement style",
    };
  };

  // ─── Chat Style Trainer Logic (Desktop V2 Multi-Language Parity) ───
  const startTrainingSession = (langCode, forceFresh = false) => {
    const targetLang = langCode || trainingLang || "en";
    setTrainingLang(targetLang);
    const existing = form?.chatStyleProfiles?.[targetLang];
    const persona = getPersonaForLang(targetLang);

    // If continuing an existing partial session, restore all saved conversation messages
    if (
      !forceFresh &&
      existing?.partial &&
      existing?.savedMessages &&
      existing.savedMessages.length > 0
    ) {
      setChatMessages([...existing.savedMessages]);
      setSessionCompleted(false);
      setStyleView("chat");
      return;
    }

    // Fresh session start
    setChatMessages([
      {
        id: "1",
        sender: "match",
        text: persona.opener,
        personaName: persona.name,
      },
    ]);
    setSessionCompleted(false);
    setStyleView("chat");
  };

  const restartTrainingSession = () => {
    const persona = getPersonaForLang(trainingLang);
    setChatMessages([
      {
        id: "1",
        sender: "match",
        text: persona.opener,
        personaName: persona.name,
      },
    ]);
    setSessionCompleted(false);
  };

  // ─── Dynamic AI Match Reply Generator (Desktop V2 handleStyleTrainingReply Parity) ───
  const generateAIMatchReply = async (
    conversation,
    personaName,
    targetLang,
    lastWasGarbage,
    isFinal,
  ) => {
    const apiKey = form?.apiKey || settings?.apiKey;
    const model = form?.aiModel || settings?.aiModel || "gpt-4o-mini";

    // 1. Live OpenAI generation if API key is present (exact Desktop V2 parity)
    if (apiKey && typeof apiKey === "string" && apiKey.trim().length > 10) {
      try {
        const rtc = form?.remoteStyleTrainingConfig || {};
        const trainingReplySystemPrompt = rtc.trainingReplySystemPrompt || null;
        const trainingReplyFinalPrompt = rtc.trainingReplyFinalPrompt || null;
        const trainingReplyTemperature =
          typeof rtc.trainingReplyTemperature === "number"
            ? rtc.trainingReplyTemperature
            : 0.7;
        const trainingReplyMaxTokens =
          typeof rtc.trainingReplyMaxTokens === "number"
            ? rtc.trainingReplyMaxTokens
            : 100;
        const personaEmojiEnabled =
          typeof rtc.personaEmojiEnabled === "boolean"
            ? rtc.personaEmojiEnabled
            : true;
        const emojiInstruction = personaEmojiEnabled
          ? ""
          : "\nDo NOT use any emojis in your reply.";

        const LANG_MAP = {
          en: "English",
          es: "Spanish",
          fr: "French",
          de: "German",
          it: "Italian",
          pt: "Portuguese",
          ru: "Russian",
          zh: "Chinese",
          ja: "Japanese",
          ko: "Korean",
          ar: "Arabic",
          hi: "Hindi",
          nl: "Dutch",
          pl: "Polish",
          tr: "Turkish",
          sv: "Swedish",
          da: "Danish",
          fi: "Finnish",
          nb: "Norwegian",
          cs: "Czech",
          sk: "Slovak",
          ro: "Romanian",
          hu: "Hungarian",
          el: "Greek",
          he: "Hebrew",
          uk: "Ukrainian",
          id: "Indonesian",
          ms: "Malay",
          vi: "Vietnamese",
          th: "Thai",
          fa: "Persian",
          ur: "Urdu",
          sw: "Swahili",
          bn: "Bengali",
        };

        const ROMANIZED_LANGS = {
          hi: 'Hinglish (Hindi written in English/Latin script, the way Indians actually text — e.g. "kese ho", "kya chal raha hai", "bahut badhiya")',
          ur: 'Urdu written in Latin/Roman script (the way Pakistani users actually text — e.g. "kya haal hai", "bohat acha")',
          bn: 'Bengali written in Latin/Roman script (the way users actually text — e.g. "ki korcho", "bhalo acho")',
        };

        const langInstruction = ROMANIZED_LANGS[targetLang]
          ? `\nIMPORTANT: Write ALL your messages in ${ROMANIZED_LANGS[targetLang]}. Do NOT use native script (Devanagari, Arabic, Bengali). Use Latin letters only, exactly like real texters do.`
          : targetLang && targetLang !== "en" && LANG_MAP[targetLang]
            ? `\nIMPORTANT: Write ALL your messages in ${LANG_MAP[targetLang]}. Every word must be in ${LANG_MAP[targetLang]}.`
            : "";

        const historyLines = (conversation || [])
          .slice(-8)
          .map(
            (m) =>
              `${m.sender === "user" || m.role === "user" ? "User" : personaName}: ${m.text}`,
          )
          .join("\n");

        const garbageInstruction = lastWasGarbage
          ? `\nIMPORTANT: The user just sent a nonsensical/random reply (keyboard mash or gibberish). React naturally — tease them lightly or call it out in a playful way, then redirect and ask them a real question. Do NOT play along as if it made sense.`
          : "";

        const systemPrompt = isFinal
          ? trainingReplyFinalPrompt
            ? trainingReplyFinalPrompt.replace(
                /\{personaName\}/g,
                personaName,
              ) +
              langInstruction +
              emojiInstruction
            : `You are ${personaName}, an attractive person on a dating app wrapping up a great conversation.
React warmly and genuinely to their last message. Keep it short (1 sentence), casual, and real — like you actually enjoyed talking to them. No questions. No "let's do this again". No formal goodbyes. Just a natural, warm closing moment.${langInstruction}${emojiInstruction}`
          : trainingReplySystemPrompt
            ? trainingReplySystemPrompt.replace(
                /\{personaName\}/g,
                personaName,
              ) +
              garbageInstruction +
              langInstruction +
              emojiInstruction
            : `You are ${personaName}, an attractive person on Tinder having a real conversation with someone you're interested in.
Your goal is to keep the conversation fun, flirty, and naturally build attraction — like a real date would.
Guidelines:
- React to what they said, then pivot toward getting to know them better romantically or personally
- Mix light flirting with genuine curiosity about them as a person
- Occasionally tease playfully or drop a subtle compliment
- Keep replies SHORT (1-2 sentences). Casual texting style, no formal punctuation
- Ask questions that move toward meeting up, learning their vibe, or finding chemistry
- Topics: lifestyle, personality, humor, adventures, attraction — NOT just logistics or food facts
NEVER mention you are an AI or a simulation. Sound like a real attractive person who's interested.${garbageInstruction}${langInstruction}${emojiInstruction}`;

        const userPrompt = `Here is the conversation so far:\n${historyLines}\n\nWrite ${personaName}'s next reply. Output ONLY the message text, no name prefix, no quotes:`;

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({
            model,
            temperature: trainingReplyTemperature,
            max_tokens: trainingReplyMaxTokens,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          let reply = data.choices?.[0]?.message?.content || "";
          reply = reply
            .trim()
            .replace(
              /^["'\u2018\u2019\u201c\u201d]+|["'\u2018\u2019\u201c\u201d]+$/g,
              "",
            )
            .replace(new RegExp(`^${personaName}\\s*:\\s*`, "i"), "")
            .trim();
          if (reply) return reply;
        }
      } catch (err) {
        console.warn(
          "[AutomationV2] Live AI generation error, using contextual fallback engine:",
          err,
        );
      }
    }

    // 2. Smart Contextual Conversation Engine (handles greetings, questions, short replies naturally)
    const persona = getPersonaForLang(targetLang);
    const lastUserMsg =
      conversation
        .filter((m) => m.sender === "user" || m.role === "user")
        .slice(-1)[0]?.text || "";
    const cleanLower = lastUserMsg.toLowerCase().trim();

    if (lastWasGarbage) {
      return "haha what does that even mean? 😂 tell me something real about you!";
    }

    // Contextual greeting detection: "hi", "hello", "hey", "hey what's up"
    if (
      /^(hi|hey|hello|heyy|heyyy|yo|howdy|sup|what's up|whats up|hola|bonjour|ciao|namaste|hlo)\b/i.test(
        cleanLower,
      ) &&
      cleanLower.split(/\s+/).length <= 4
    ) {
      const greetingReplies = [
        `hey! how's your day going so far? 😊`,
        `hey there :) what are you up to today?`,
        `hey! glad we matched 👀 what did you get up to this weekend?`,
      ];
      return greetingReplies[
        Math.floor(Math.random() * greetingReplies.length)
      ];
    }

    // Contextual question response
    if (cleanLower.includes("?")) {
      const questionReplies = [
        "haha good question! honestly i love spontaneous trips and finding hidden coffee spots ☕ what about you?",
        "definitely into good music, travel and fun weekend plans! what's your vibe?",
        "honestly just relaxing and enjoying good conversations :) what do you do for fun?",
      ];
      return questionReplies[
        Math.floor(Math.random() * questionReplies.length)
      ];
    }

    // Conversational follow-ups
    const validCount = conversation.filter(
      (m) => (m.sender === "user" || m.role === "user") && !m.garbage,
    ).length;
    const replyIdx = Math.min(validCount - 1, persona.replies.length - 1);
    return (
      persona.replies[replyIdx] ||
      "haha love that energy! what's something you're passionate about lately?"
    );
  };

  const sendPracticeMessage = async () => {
    const userText = inputPracticeMsg.trim();
    if (!userText || sessionCompleted || calibrating) return;

    // Desktop V2 MIN_MESSAGE_CHARS = 4 validation
    if (userText.length < 4) {
      setInputShaking(true);
      setInputWarning(
        "Write at least a few words, like you'd actually text someone.",
      );
      setTimeout(() => setInputShaking(false), 1200);
      setTimeout(() => setInputWarning(""), 2500);
      return;
    }

    setInputWarning("");
    setInputShaking(false);
    setInputPracticeMsg("");

    const isGarbage = isGarbageMessage(userText);
    const newMsgObj = {
      id: String(Date.now()),
      sender: "user",
      text: userText,
      garbage: isGarbage,
    };

    let updatedMsgs = [...chatMessages, newMsgObj];

    if (isGarbage) {
      updatedMsgs.push({
        id: String(Date.now() + 1),
        sender: "system",
        text: "That doesn't look like a real reply. Write something you'd actually send to someone you're interested in.",
      });
    }

    setChatMessages(updatedMsgs);

    const validCount = updatedMsgs.filter(
      (m) => m.sender === "user" && !m.garbage,
    ).length;
    const persona = getPersonaForLang(trainingLang);
    const isFinal = validCount >= 12;

    setCalibrating(true);

    try {
      const matchReply = await generateAIMatchReply(
        updatedMsgs,
        persona.name,
        trainingLang,
        isGarbage,
        isFinal,
      );
      setChatMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 2),
          sender: "match",
          text: matchReply,
          personaName: persona.name,
        },
      ]);
      if (isFinal) {
        setSessionCompleted(true);
      }
    } catch (_) {
      const fallbackReply =
        persona.replies[Math.min(validCount - 1, persona.replies.length - 1)] ||
        "haha tell me more about that!";
      setChatMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 2),
          sender: "match",
          text: fallbackReply,
          personaName: persona.name,
        },
      ]);
    } finally {
      setCalibrating(false);
    }
  };

  const generateAIStyleSummary = async (userMessages) => {
    const apiKey = form?.apiKey || settings?.apiKey;
    const model = form?.aiModel || settings?.aiModel || "gpt-4o-mini";

    if (
      apiKey &&
      typeof apiKey === "string" &&
      apiKey.trim().length > 10 &&
      userMessages?.length
    ) {
      try {
        const rtc = form?.remoteStyleTrainingConfig || {};
        const summarySystemPrompt =
          rtc.summarySystemPrompt ||
          `You are a communication style analyst. Based on someone's real text messages, write a single honest, specific, plain-English sentence (max 25 words) describing how they text. Address them directly using "You" — e.g. "You keep things short and direct..." Focus on what actually stands out — their energy, pace, directness, warmth, or humor. No generic filler. No em dashes. No bullet points. Just one sentence starting with "You".`;
        const summaryTemperature =
          typeof rtc.summaryTemperature === "number"
            ? rtc.summaryTemperature
            : 0.7;
        const summaryMaxTokens =
          typeof rtc.summaryMaxTokens === "number" ? rtc.summaryMaxTokens : 60;

        const examples = (userMessages || [])
          .slice(0, 12)
          .map((m) => `- "${m}"`)
          .join("\n");
        const userPrompt = `Here are their messages:\n${examples}\n\nDescribe their texting style in one sentence:`;

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({
            model,
            temperature: summaryTemperature,
            max_tokens: summaryMaxTokens,
            messages: [
              { role: "system", content: summarySystemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const clean = (data.choices?.[0]?.message?.content || "")
            .trim()
            .replace(/^["'\u201c\u201d]+|["'\u201c\u201d]+$/g, "")
            .replace(/\s—\s/g, ", ")
            .replace(/—/g, ", ")
            .trim();
          if (clean) return clean;
        }
      } catch (err) {
        console.warn("[AutomationV2] Style summary generation error:", err);
      }
    }
    return null;
  };

  const finishAndSaveSession = async () => {
    const userMessages = chatMessages
      .filter((m) => m.sender === "user" || m.role === "user")
      .map((m) => m.text);
    const validMessages = userMessages.filter((m) => !isGarbageMessage(m));
    const minQualityRatio =
      form?.remoteStyleTrainingConfig?.minQualityRatio ?? 0.5;

    if (
      userMessages.length > 0 &&
      validMessages.length / userMessages.length < minQualityRatio
    ) {
      setStyleView("lowQuality");
      return;
    }

    const analysis = analyzeUserStyle(chatMessages);
    const customSummary = await generateAIStyleSummary(validMessages);
    if (customSummary && analysis) {
      analysis.whatAiNoticed = customSummary;
    }

    const persona = getPersonaForLang(trainingLang);
    const updatedProfiles = { ...(form.chatStyleProfiles || {}) };
    updatedProfiles[trainingLang] = {
      trained: true,
      partial: false,
      messageCount: 12,
      trainedAt: Date.now(),
      trainingLanguage: trainingLang,
      personaName: persona.name,
      savedMessages: chatMessages,
      aiSummary: analysis,
    };
    updateField("chatStyleProfiles", updatedProfiles);
    updateField("chatStyleProfile", updatedProfiles[trainingLang]);
    setViewingLang(trainingLang);
    setStyleView("insights");
  };

  const saveStyleInline = async () => {
    const validCount = chatMessages.filter(
      (m) => m.sender === "user" && !m.garbage,
    ).length;
    if (validCount > 0) {
      const persona = getPersonaForLang(trainingLang);
      const analysis = analyzeUserStyle(chatMessages);
      const userMessages = chatMessages
        .filter((m) => (m.sender === "user" || m.role === "user") && !m.garbage)
        .map((m) => m.text);
      const customSummary = await generateAIStyleSummary(userMessages);
      if (customSummary && analysis) {
        analysis.whatAiNoticed = customSummary;
      }
      const updatedProfiles = { ...(form.chatStyleProfiles || {}) };
      updatedProfiles[trainingLang] = {
        trained: true,
        partial: validCount < 12,
        messageCount: validCount,
        trainedAt: Date.now(),
        trainingLanguage: trainingLang,
        personaName: persona.name,
        savedMessages: chatMessages,
        aiSummary: analysis,
      };
      updateField("chatStyleProfiles", updatedProfiles);
      updateField("chatStyleProfile", updatedProfiles[trainingLang]);
      setInlineSaved(true);
      setTimeout(() => setInlineSaved(false), 3000);
    }
  };

  const savePartialSession = () => {
    saveStyleInline();
    setStyleView("intro");
  };

  const handleSwitchSimLanguage = (newCode) => {
    setSimLangModalOpen(false);
    if (!newCode || newCode === trainingLang) return;

    const validCount = chatMessages.filter(
      (m) => m.sender === "user" && !m.garbage,
    ).length;

    const doSwitch = () => {
      setTrainingLang(newCode);
      const existing = form?.chatStyleProfiles?.[newCode];
      if (
        existing?.partial &&
        existing?.savedMessages &&
        existing.savedMessages.length > 0
      ) {
        setChatMessages([...existing.savedMessages]);
      } else {
        const persona = getPersonaForLang(newCode);
        setChatMessages([
          {
            id: "1",
            sender: "match",
            text: persona.opener,
            personaName: persona.name,
          },
        ]);
      }
      setSessionCompleted(false);
      setInputWarning("");
      setInputShaking(false);
      updateField("conversationLanguage", newCode);
    };

    if (validCount >= 3) {
      const targetLabel =
        LANGUAGE_OPTIONS.find((l) => l.code === newCode)?.label || newCode;
      Alert.alert(
        `Switch to ${targetLabel}?`,
        `You've sent ${validCount} messages in this session. Switching language will load that language's training session.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Switch", onPress: doSwitch },
        ],
      );
    } else {
      doSwitch();
    }
  };

  const trainAnotherLanguage = () => {
    const profiles = form?.chatStyleProfiles || {};
    const untrained = LANGUAGE_OPTIONS.find((l) => !profiles[l.code]?.trained);
    const nextLang = untrained?.code || (trainingLang === "en" ? "es" : "en");
    setTrainingLang(nextLang);
    setStyleView("intro");
  };

  const deleteProfile = (langCode) => {
    const label =
      LANGUAGE_OPTIONS.find((l) => l.code === langCode)?.label || langCode;
    Alert.alert(
      `Delete ${label} style?`,
      `This will permanently remove your trained ${label} profile. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            const updatedProfiles = { ...(form.chatStyleProfiles || {}) };
            delete updatedProfiles[langCode];
            updateField("chatStyleProfiles", updatedProfiles);
            if (form.chatStyleProfile?.trainingLanguage === langCode) {
              updateField("chatStyleProfile", null);
            }
            setStyleView("intro");
          },
        },
      ],
    );
  };

  if (loading || !form) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="small" color={uiTheme.colors.primary} />
        <Text style={styles.loadingText}>
          Syncing Automation V2 configuration...
        </Text>
      </View>
    );
  }

  // ─── Collapsed Summary Chip Generators ───
  const getGoalSummary = () => {
    const goalObj =
      GOAL_OPTIONS.find((g) => g.id === form?.goal) || GOAL_OPTIONS[0];
    return goalObj.label;
  };

  const getContactSummary = () => {
    if (form.contactDetails?.whatsapp?.value)
      return `WA: ${form.contactDetails.whatsapp.value}`;
    if (form.contactDetails?.instagram?.value)
      return `IG: @${form.contactDetails.instagram.value.replace("@", "")}`;
    // if (form.contactDetails?.telegram?.value) return `TG: @${form.contactDetails.telegram.value.replace('@', '')}`;
    return "No handle set";
  };

  const isSafetyOn = form?.safetyMode !== false;
  const isAutoSwipeOn = isSafetyOn ? true : (form?.likesPerCycle ?? 50) > 0;

  const getSwipingSummary = () => {
    const likes = isSafetyOn
      ? "Auto Swipe (Safe)"
      : isAutoSwipeOn
        ? "Auto Swipe On"
        : "Auto Swipe Off";
    const pacing =
      form?.scheduleInterval === 120
        ? "Every 2 Hours"
        : form?.scheduleInterval === 60
          ? "Every Hour"
          : "Every 30 min";
    const age = form?.ageFilter?.enabled
      ? `Age: ${form?.ageFilter?.min ?? 20}-${form?.ageFilter?.max ?? 35}`
      : "Age: All";
    return { likes, pacing, age };
  };

  const getMessagingSummary = () => {
    const toneVal = form?.tone || form?.chattingStyle || "Freestyle";
    const tone = `${toneVal.charAt(0).toUpperCase() + toneVal.slice(1)}`;
    const intentionObj = INTENTIONS_OPTIONS.find(
      (i) => i.id === form?.intentions,
    ) || { label: "Short term dating" };
    const intention = intentionObj.label.split(" ").slice(0, 3).join(" ");
    const langObj = LANGUAGE_OPTIONS.find(
      (l) => l.code === (form?.conversationLanguage || "en"),
    ) || { label: "English", flag: "🇺🇸" };
    const lang = `${langObj.flag} ${langObj.label}`;
    const priorityVal = form?.prioritySlider ?? form?.minReplySlots ?? 50;
    const priority =
      priorityVal === 30
        ? "70 : 30"
        : priorityVal === 70
          ? "30 : 70"
          : "50 : 50";
    const emojis = form?.useEmojis !== false ? "Emojis On" : "No Emojis";
    const consecutive = form?.consecutiveMessagesEnabled ? "Multi-text" : null;
    return { tone, intention, lang, priority, emojis, consecutive };
  };

  const getStyleSummary = () => {
    const profiles = form?.chatStyleProfiles || {};
    const legacy = form?.chatStyleProfile;
    if (legacy?.trained && !profiles[legacy.trainingLanguage || "en"]) {
      profiles[legacy.trainingLanguage || "en"] = legacy;
    }
    const trainedLangs = Object.keys(profiles).filter(
      (k) => profiles[k]?.trained,
    );
    if (!trainedLangs.length)
      return [{ label: "No style trained yet", full: false }];
    return trainedLangs.map((code) => {
      const p = profiles[code];
      const langObj = LANGUAGE_OPTIONS.find((l) => l.code === code) || {
        label: code,
        flag: "🌐",
      };
      if (p.partial) {
        return {
          label: `${langObj.flag} ${langObj.label} ${p.messageCount || 0}/12`,
          full: false,
        };
      }
      return { label: `✓ ${langObj.flag} ${langObj.label}`, full: true };
    });
  };

  const getActiveTimeSummary = () => {
    if (form.activeHours?.enabled === false) return "24/7 (Always Active)";
    const start = minsToDisplay(
      timeToMins(form.activeHours?.startTime || "09:00"),
    );
    const end = minsToDisplay(timeToMins(form.activeHours?.endTime || "22:00"));
    return `${start} – ${end}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.scrollContent}>
        {/* ════════════════════ CARD 1: YOUR DATING GOAL (V2 DESKTOP PARITY) ════════════════════ */}
        <View style={[styles.v2Card, openCards.goal && styles.v2CardOpen]}>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.v2CardHeader}
            onPress={() => toggleCard("goal")}
            activeOpacity={0.85}
          >
            <View style={styles.cardTitleWrap}>
              <Ionicons
                name="flag-outline"
                size={17}
                color={uiTheme.colors.primary}
              />
              <Text style={styles.v2CardTitle}>Your Dating Goal</Text>
            </View>
            <Ionicons
              name={openCards.goal ? "chevron-up" : "chevron-down"}
              size={18}
              color={uiTheme.colors.muted}
            />
          </TouchableOpacity>

          {/* Collapsed Summary Chips */}
          {!openCards.goal && (
            <View style={styles.collapsedRow}>
              <View style={styles.v2Chip}>
                <Ionicons
                  name="locate"
                  size={11}
                  color={uiTheme.colors.primary}
                />
                <Text style={styles.v2ChipText}>{getGoalSummary()}</Text>
              </View>
              <View style={styles.v2Chip}>
                <Text style={styles.v2ChipText}>
                  {form.stopAfterGoal !== false && form.goal !== "never"
                    ? "Stop After Goal"
                    : "Stop Off"}
                </Text>
              </View>
              <View style={styles.v2Chip}>
                <Ionicons name="chatbox" size={11} color="#EC4899" />
                <Text style={styles.v2ChipText}>{getContactSummary()}</Text>
              </View>
            </View>
          )}

          {/* Expanded Card Body */}
          {openCards.goal && (
            <View style={styles.v2CardBody}>
              <Text style={styles.fieldDesc}>
                Select how the AI Wingman steers and closes conversations:
              </Text>

              {/* ─── Primary Dating Goal & Stop After Goal Box ─── */}
              <View style={styles.subBox}>
                <V2Dropdown
                  label="Primary Goal"
                  options={GOAL_OPTIONS.map((g) => ({
                    id: g.id,
                    value: g.id,
                    label: g.label,
                    desc: g.desc,
                    icon: g.icon,
                  }))}
                  selectedValue={form.goal || "never"}
                  onSelect={(val) => updateField("goal", val)}
                />

                <View style={styles.subBoxDivider} />

                {/* Stop After Goal Toggle */}
                <View style={styles.rowBetween}>
                  <Text style={styles.toggleTitle}>Stop After Goal</Text>
                  <Switch
                    value={
                      form.stopAfterGoal !== false && form.goal !== "never"
                    }
                    disabled={form.goal === "never"}
                    onValueChange={(v) => updateField("stopAfterGoal", v)}
                    trackColor={{
                      false: uiTheme.colors.elevated,
                      true: uiTheme.colors.primary,
                    }}
                    thumbColor={
                      form.stopAfterGoal !== false && form.goal !== "never"
                        ? "#FFF"
                        : uiTheme.colors.muted
                    }
                  />
                </View>
              </View>

              {/* Date Setup Sub-Activity Choice (Commented Out - not in Desktop V2) */}
              {/*
              {form.goal === 'date' && (
                <View style={styles.subBox}>
                  <Text style={styles.subBoxTitle}>Date Activity Type</Text>
                  <View style={styles.chipRow}>
                    {DATE_GOALS.map(dg => (
                      <TouchableOpacity
                        key={dg}
                        style={[styles.chip, form.datesetupGoal === dg && styles.chipActive]}
                        onPress={() => updateField('datesetupGoal', dg)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, form.datesetupGoal === dg && styles.chipTextActive]}>
                          {dg.charAt(0).toUpperCase() + dg.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              */}

              {/* ─── Your Contact Details Accordion Section (Desktop V2 Parity) ─── */}
              <View style={styles.contactSection}>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.contactHeader}
                  onPress={toggleContactDetails}
                  activeOpacity={0.8}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Ionicons
                      name="card-outline"
                      size={16}
                      color={uiTheme.colors.primary}
                    />
                    <Text style={styles.contactHeaderTitle}>
                      Your Contact Details
                    </Text>
                  </View>
                  <Ionicons
                    name={contactDetailsOpen ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={uiTheme.colors.muted}
                  />
                </TouchableOpacity>

                {contactDetailsOpen && (
                  <View style={{ marginTop: 12 }}>
                    {/* Instagram Row */}
                    <View style={styles.contactRow}>
                      <Ionicons
                        name="logo-instagram"
                        size={17}
                        color="#E1306C"
                        style={{ width: 22 }}
                      />
                      <Text style={styles.contactRowLabel}>Instagram</Text>
                      <TextInput
                        style={styles.contactInput}
                        placeholder="@yourhandle"
                        placeholderTextColor="#55526B"
                        autoCapitalize="none"
                        value={form.contactDetails?.instagram?.value || ""}
                        onChangeText={(val) =>
                          updateField("contactDetails.instagram.value", val)
                        }
                      />
                      <Switch
                        value={
                          form.contactDetails?.instagram?.enabled !== false
                        }
                        onValueChange={(v) =>
                          updateField("contactDetails.instagram.enabled", v)
                        }
                        trackColor={{
                          false: uiTheme.colors.elevated,
                          true: uiTheme.colors.primary,
                        }}
                        thumbColor={
                          form.contactDetails?.instagram?.enabled !== false
                            ? "#FFF"
                            : uiTheme.colors.muted
                        }
                      />
                    </View>
                    <View style={styles.handleStatRow}>
                      <Ionicons
                        name="mail-outline"
                        size={11}
                        color={uiTheme.colors.muted}
                      />
                      <Text style={styles.handleStatText}>
                        Sent to{" "}
                        <Text
                          style={{
                            fontFamily: "Inter_700Bold",
                            color: uiTheme.colors.primary,
                            fontWeight: "normal",
                          }}
                        >
                          {form.handleSentStats?.instagram || 0}
                        </Text>{" "}
                        matches
                      </Text>
                    </View>

                    {/* Telegram Row (Commented Out) */}
                    {/*
                    <View style={styles.contactRow}>
                      <Ionicons name="paper-plane" size={17} color="#26A5E4" style={{ width: 22 }} />
                      <Text style={styles.contactRowLabel}>Telegram</Text>
                      <TextInput
                        style={styles.contactInput}
                        placeholder="@yourhandle"
                        placeholderTextColor="#55526B"
                        autoCapitalize="none"
                        value={form.contactDetails?.telegram?.value || ''}
                        onChangeText={val => updateField('contactDetails.telegram.value', val)}
                      />
                      <Switch
                        value={form.contactDetails?.telegram?.enabled !== false}
                        onValueChange={v => updateField('contactDetails.telegram.enabled', v)}
                        trackColor={{ false: '#26223B', true: '#FE3C72' }}
                        thumbColor={form.contactDetails?.telegram?.enabled !== false ? '#FFF' : '#716E89'}
                      />
                    </View>
                    <View style={styles.handleStatRow}>
                      <Ionicons name="mail-outline" size={11} color="#716E89" />
                      <Text style={styles.handleStatText}>
                        Sent to <Text style={{ color: '#26A5E4', fontWeight: 'bold' }}>{form.handleSentStats?.telegram || 0}</Text> matches
                      </Text>
                    </View>
                    */}

                    {/* Tango Row (Commented Out) */}
                    {/*
                    <View style={styles.contactRow}>
                      <Ionicons name="call" size={17} color="#FF5C5C" style={{ width: 22 }} />
                      <Text style={styles.contactRowLabel}>Tango</Text>
                      <TextInput
                        style={styles.contactInput}
                        placeholder="@yourusername"
                        placeholderTextColor="#55526B"
                        autoCapitalize="none"
                        value={form.contactDetails?.tango?.value || ''}
                        onChangeText={val => updateField('contactDetails.tango.value', val)}
                      />
                      <Switch
                        value={form.contactDetails?.tango?.enabled === true}
                        onValueChange={v => updateField('contactDetails.tango.enabled', v)}
                        trackColor={{ false: '#26223B', true: '#FE3C72' }}
                        thumbColor={form.contactDetails?.tango?.enabled === true ? '#FFF' : '#716E89'}
                      />
                    </View>
                    <View style={styles.handleStatRow}>
                      <Ionicons name="mail-outline" size={11} color="#716E89" />
                      <Text style={styles.handleStatText}>
                        Sent to <Text style={{ color: '#FF5C5C', fontWeight: 'bold' }}>{form.handleSentStats?.tango || 0}</Text> matches
                      </Text>
                    </View>
                    */}

                    {/* WhatsApp Row */}
                    <View style={styles.contactRow}>
                      <Ionicons
                        name="logo-whatsapp"
                        size={17}
                        color="#25D366"
                        style={{ width: 22 }}
                      />
                      <Text style={styles.contactRowLabel}>WhatsApp</Text>
                      <TextInput
                        style={styles.contactInput}
                        placeholder="+1 555 000 0000"
                        placeholderTextColor="#55526B"
                        keyboardType="phone-pad"
                        value={form.contactDetails?.whatsapp?.value || ""}
                        onChangeText={(val) =>
                          updateField("contactDetails.whatsapp.value", val)
                        }
                      />
                      <Switch
                        value={form.contactDetails?.whatsapp?.enabled !== false}
                        onValueChange={(v) =>
                          updateField("contactDetails.whatsapp.enabled", v)
                        }
                        trackColor={{
                          false: uiTheme.colors.elevated,
                          true: uiTheme.colors.primary,
                        }}
                        thumbColor={
                          form.contactDetails?.whatsapp?.enabled !== false
                            ? "#FFF"
                            : uiTheme.colors.muted
                        }
                      />
                    </View>
                    <View style={styles.handleStatRow}>
                      <Ionicons
                        name="mail-outline"
                        size={11}
                        color={uiTheme.colors.muted}
                      />
                      <Text style={styles.handleStatText}>
                        Sent to{" "}
                        <Text
                          style={{
                            fontFamily: "Inter_700Bold",
                            color: "#25D366",
                            fontWeight: "normal",
                          }}
                        >
                          {form.handleSentStats?.whatsapp || 0}
                        </Text>{" "}
                        matches
                      </Text>
                    </View>

                    <Text style={styles.helperNote}>
                      Toggle on the details you want the AI to share when a
                      match asks for your contact.
                    </Text>

                    <View style={styles.subBoxDivider} />

                    {/* ─── Your Gender Selector ─── */}
                    <View style={{ marginTop: 6 }}>
                      <Text style={styles.inputLabel}>Your gender</Text>
                      <View style={styles.genderSelector}>
                        {GENDER_OPTIONS.map((g) => {
                          const currentGender = (
                            form.userGenderOverride || "auto"
                          ).toLowerCase();
                          const isSelected = currentGender === g.id;
                          return (
                            <TouchableOpacity
                              accessibilityRole="button"
                              key={g.id}
                              style={[
                                styles.genderBtn,
                                isSelected && styles.genderBtnActive,
                              ]}
                              onPress={() =>
                                updateField("userGenderOverride", g.id)
                              }
                              activeOpacity={0.8}
                            >
                              <Text
                                style={[
                                  styles.genderBtnText,
                                  isSelected && styles.genderBtnTextActive,
                                ]}
                              >
                                {g.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <Text style={styles.helperNote}>
                        Used for grammar in AI messages. Auto = detected from
                        your profile. Set manually if Auto is wrong.
                      </Text>
                    </View>

                    {/* ─── Move Off App Configuration Block (Commented Out) ─── */}
                    {/*
                    <View style={styles.subBoxDivider} />

                    <View style={{ marginTop: 6 }}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.toggleTitle}>Push on all matches</Text>
                        <Switch
                          value={form.moveOffAppPushAllMatches === true}
                          onValueChange={v => updateField('moveOffAppPushAllMatches', v)}
                          trackColor={{ false: '#26223B', true: '#FE3C72' }}
                          thumbColor={form.moveOffAppPushAllMatches ? '#FFF' : '#716E89'}
                        />
                      </View>
                      <Text style={styles.helperNote}>
                        <Text style={{ color: '#A09FB8', fontWeight: '600' }}>ON</Text> — AI drops your handle in every message. No discretion.{'\n'}
                        <Text style={{ color: '#A09FB8', fontWeight: '600' }}>OFF</Text> — AI waits for the right moment to bring it up.
                      </Text>

                      <View style={[styles.rowBetween, { marginTop: 12 }]}>
                        <Text style={styles.inputLabel}>Messages before nudge</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <TextInput
                            style={[styles.smallInput, { width: 55 }]}
                            keyboardType="numeric"
                            placeholder="Min"
                            placeholderTextColor="#55526B"
                            value={String(form.moveOffAppMinMessages ?? 0)}
                            onChangeText={v => updateField('moveOffAppMinMessages', parseInt(v, 10) || 0)}
                          />
                          <Text style={{ color: '#8E8DA3', fontSize: 12 }}>to</Text>
                          <TextInput
                            style={[styles.smallInput, { width: 55 }]}
                            keyboardType="numeric"
                            placeholder="Max"
                            placeholderTextColor="#55526B"
                            value={String(form.moveOffAppMaxMessages ?? 0)}
                            onChangeText={v => updateField('moveOffAppMaxMessages', parseInt(v, 10) || 0)}
                          />
                        </View>
                      </View>
                      <Text style={styles.helperNote}>
                        AI will mention your handle at a random point between Min and Max messages. (0–0 = AI picks the best moment on its own).
                      </Text>

                      <View style={[styles.rowBetween, { marginTop: 12 }]}>
                        <Text style={styles.inputLabel}>Max persuasion attempts</Text>
                        <TextInput
                          style={[styles.smallInput, { width: 55 }]}
                          keyboardType="numeric"
                          placeholder="2"
                          placeholderTextColor="#55526B"
                          value={String(form.moveOffAppMaxPersuasion ?? 2)}
                          onChangeText={v => updateField('moveOffAppMaxPersuasion', parseInt(v, 10) || 2)}
                        />
                      </View>
                      <Text style={styles.helperNote}>
                        How many times the AI tries to convince a match who rejects your handle. After this many attempts, the AI stops messaging them.
                      </Text>
                    </View>
                    */}
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* ════════════════════ CARD 2: SWIPING & SAFETY LIMITS ════════════════════ */}
        {
          // <View style={[styles.v2Card, openCards.swiping && styles.v2CardOpen]}>
          //           <TouchableOpacity
          //             accessibilityRole="button"
          //             style={styles.v2CardHeader}
          //             onPress={() => toggleCard("swiping")}
          //             activeOpacity={0.85}
          //           >
          //             <View style={styles.cardTitleWrap}>
          //               <Ionicons
          //                 name="heart-outline"
          //                 size={17}
          //                 color={uiTheme.colors.primary}
          //               />
          //               <Text style={styles.v2CardTitle}>Swiping</Text>
          //             </View>
          //             <Ionicons
          //               name={openCards.swiping ? "chevron-up" : "chevron-down"}
          //               size={18}
          //               color={uiTheme.colors.muted}
          //             />
          //           </TouchableOpacity>
          //
          //           {/* Collapsed Summary Chips */}
          //           {!openCards.swiping && (
          //             <View style={styles.collapsedRow}>
          //               <View style={styles.v2Chip}>
          //                 <Ionicons
          //                   name="flash"
          //                   size={11}
          //                   color={uiTheme.colors.primary}
          //                 />
          //                 <Text style={styles.v2ChipText}>
          //                   {getSwipingSummary().likes}
          //                 </Text>
          //               </View>
          //               <View style={styles.v2Chip}>
          //                 <Ionicons
          //                   name="time-outline"
          //                   size={11}
          //                   color={uiTheme.colors.info}
          //                 />
          //                 <Text style={styles.v2ChipText}>
          //                   {getSwipingSummary().pacing}
          //                 </Text>
          //               </View>
          //               <View style={styles.v2Chip}>
          //                 <Text style={styles.v2ChipText}>{getSwipingSummary().age}</Text>
          //               </View>
          //             </View>
          //           )}
          //
          //           {/* Expanded Body */}
          //           {openCards.swiping && (
          //             <View style={styles.v2CardBody}>
          //               <Text style={styles.fieldDesc}>
          //                 Control swipe batches, cooldown pacing & profile filters:
          //               </Text>
          //
          //               {/* Core Swiping Controls (Auto Swipe & Activity Speed) */}
          //               <View
          //                 style={[
          //                   styles.subBox,
          //                   isSafetyOn && { borderColor: "rgba(254, 60, 114, 0.2)" },
          //                 ]}
          //               >
          //                 {/* Auto Swipe Toggle */}
          //                 <View style={styles.rowBetween}>
          //                   <View style={{ flex: 1, paddingRight: 10 }}>
          //                     <View
          //                       style={{
          //                         flexDirection: "row",
          //                         alignItems: "center",
          //                         gap: 6,
          //                       }}
          //                     >
          //                       <Text style={styles.toggleTitle}>Auto Swipe</Text>
          //                       {isSafetyOn && (
          //                         <View style={styles.safetyChipBadge}>
          //                           <Ionicons
          //                             name="shield-checkmark"
          //                             size={10}
          //                             color={uiTheme.colors.success}
          //                           />
          //                           <Text style={styles.safetyChipBadgeText}>
          //                             Safety Mode
          //                           </Text>
          //                         </View>
          //                       )}
          //                     </View>
          //                     <Text style={styles.labelMuted}>
          //                       {isSafetyOn
          //                         ? "Locked ON by Safety Mode for safe batches"
          //                         : "Automatically swipe profiles on schedule"}
          //                     </Text>
          //                   </View>
          //                   <Switch
          //                     disabled={isSafetyOn}
          //                     value={isSafetyOn ? true : (form.likesPerCycle ?? 50) > 0}
          //                     onValueChange={(v) => {
          //                       if (v) {
          //                         updateField("likesPerCycle", 50);
          //                       } else {
          //                         updateField("likesPerCycle", 0);
          //                       }
          //                     }}
          //                     trackColor={{
          //                       false: uiTheme.colors.elevated,
          //                       true: uiTheme.colors.primary,
          //                     }}
          //                     thumbColor={
          //                       isSafetyOn || (form.likesPerCycle ?? 50) > 0
          //                         ? "#FFF"
          //                         : uiTheme.colors.muted
          //                     }
          //                   />
          //                 </View>
          //
          //                 <View style={styles.subBoxDivider} />
          //
          //                 {/* Activity Speed Dropdown (V2 UI Parity) */}
          //                 <V2Dropdown
          //                   label="Activity Speed"
          //                   disabled={isSafetyOn}
          //                   options={[
          //                     {
          //                       value: 30,
          //                       label: "Every 30 min",
          //                       desc: "Active cadence (Safe limit)",
          //                     },
          //                     {
          //                       value: 60,
          //                       label: "Every Hour",
          //                       desc: "Balanced background pacing",
          //                     },
          //                     {
          //                       value: 120,
          //                       label: "Every 2 Hours",
          //                       desc: "Relaxed slow pacing",
          //                     },
          //                   ]}
          //                   selectedValue={form.scheduleInterval ?? 30}
          //                   onSelect={(val) => updateField("scheduleInterval", val)}
          //                 />
          //
          //                 {isSafetyOn && (
          //                   <View
          //                     style={{
          //                       flexDirection: "row",
          //                       alignItems: "center",
          //                       marginTop: 10,
          //                     }}
          //                   >
          //                     <Ionicons
          //                       name="lock-closed"
          //                       size={11}
          //                       color={uiTheme.colors.muted}
          //                       style={{ marginRight: 5 }}
          //                     />
          //                     <Text
          //                       style={{
          //                         fontFamily: "Inter_400Regular",
          //                         color: uiTheme.colors.muted,
          //                         fontSize: 11,
          //                         fontStyle: "italic",
          //                         flex: 1,
          //                       }}
          //                     >
          //                       Auto Swipe & Speed are locked to safe defaults. Toggle
          //                       Safety Mode OFF in Settings to customize.
          //                     </Text>
          //                   </View>
          //                 )}
          //               </View>
          //
          //               {/* ─── Age Range Filter (V2 Desktop Parity) ─── */}
          //               <View style={styles.subBox}>
          //                 <View style={styles.rowBetween}>
          //                   <View style={{ flex: 1, paddingRight: 10 }}>
          //                     <Text style={styles.toggleTitle}>Age Range</Text>
          //                     <Text style={styles.labelMuted}>
          //                       Filter profiles by age bracket
          //                     </Text>
          //                   </View>
          //                   <View
          //                     style={{
          //                       flexDirection: "row",
          //                       alignItems: "center",
          //                       gap: 10,
          //                     }}
          //                   >
          //                     <View style={styles.v2ValueBadge}>
          //                       <Text style={styles.v2ValueBadgeText}>
          //                         {form.ageFilter?.enabled
          //                           ? `${form.ageFilter?.min ?? 20}–${form.ageFilter?.max ?? 35}`
          //                           : "18–99 (Off)"}
          //                       </Text>
          //                     </View>
          //                     <Switch
          //                       value={form.ageFilter?.enabled === true}
          //                       onValueChange={(v) => updateField("ageFilter.enabled", v)}
          //                       trackColor={{
          //                         false: uiTheme.colors.elevated,
          //                         true: uiTheme.colors.primary,
          //                       }}
          //                       thumbColor={
          //                         form.ageFilter?.enabled ? "#FFF" : uiTheme.colors.muted
          //                       }
          //                     />
          //                   </View>
          //                 </View>
          //
          //                 {form.ageFilter?.enabled && (
          //                   <View style={{ marginTop: 12 }}>
          //                     {/* Dual-Thumb Range Slider (Desktop V2 100% Parity) */}
          //                     <MultiRangeSlider
          //                       min={18}
          //                       max={99}
          //                       minValue={form.ageFilter?.min ?? 20}
          //                       maxValue={form.ageFilter?.max ?? 35}
          //                       unit="yrs"
          //                       onValuesChange={(newMin, newMax) => {
          //                         updateField("ageFilter.min", newMin);
          //                         updateField("ageFilter.max", newMax);
          //                       }}
          //                     />
          //
          //                     <Text
          //                       style={[
          //                         styles.inputLabel,
          //                         { marginTop: 6, marginBottom: 6 },
          //                       ]}
          //                     >
          //                       Quick Brackets
          //                     </Text>
          //                     <View style={styles.chipRow}>
          //                       {[
          //                         { min: 18, max: 25, label: "18–25" },
          //                         { min: 21, max: 30, label: "21–30" },
          //                         { min: 25, max: 35, label: "25–35" },
          //                         { min: 30, max: 45, label: "30–45" },
          //                         { min: 18, max: 99, label: "All Ages" },
          //                       ].map((b) => {
          //                         const isActive =
          //                           (form.ageFilter?.min ?? 20) === b.min &&
          //                           (form.ageFilter?.max ?? 35) === b.max;
          //                         return (
          //                           <TouchableOpacity
          //                             accessibilityRole="button"
          //                             key={b.label}
          //                             style={[styles.chip, isActive && styles.chipActive]}
          //                             onPress={() => {
          //                               updateField("ageFilter.min", b.min);
          //                               updateField("ageFilter.max", b.max);
          //                             }}
          //                             activeOpacity={0.8}
          //                           >
          //                             <Text
          //                               style={[
          //                                 styles.chipText,
          //                                 isActive && styles.chipTextActive,
          //                               ]}
          //                             >
          //                               {b.label}
          //                             </Text>
          //                           </TouchableOpacity>
          //                         );
          //                       })}
          //                     </View>
          //                   </View>
          //                 )}
          //               </View>
          //
          //               {/* ─── Distance Range Filter (V2 Desktop Parity) ─── */}
          //               <View style={styles.subBox}>
          //                 <View style={styles.rowBetween}>
          //                   <View style={{ flex: 1, paddingRight: 10 }}>
          //                     <Text style={styles.toggleTitle}>Distance Range</Text>
          //                     <Text style={styles.labelMuted}>
          //                       Maximum location distance radius
          //                     </Text>
          //                   </View>
          //                   <View
          //                     style={{
          //                       flexDirection: "row",
          //                       alignItems: "center",
          //                       gap: 10,
          //                     }}
          //                   >
          //                     <View style={styles.v2ValueBadge}>
          //                       <Text style={styles.v2ValueBadgeText}>
          //                         {form.distanceFilter?.enabled
          //                           ? `Up to ${form.distanceFilter?.maxDistance ?? 50} km`
          //                           : "No Limit (Off)"}
          //                       </Text>
          //                     </View>
          //                     <Switch
          //                       value={form.distanceFilter?.enabled === true}
          //                       onValueChange={(v) =>
          //                         updateField("distanceFilter.enabled", v)
          //                       }
          //                       trackColor={{
          //                         false: uiTheme.colors.elevated,
          //                         true: uiTheme.colors.primary,
          //                       }}
          //                       thumbColor={
          //                         form.distanceFilter?.enabled
          //                           ? "#FFF"
          //                           : uiTheme.colors.muted
          //                       }
          //                     />
          //                   </View>
          //                 </View>
          //
          //                 {form.distanceFilter?.enabled && (
          //                   <View style={{ marginTop: 12 }}>
          //                     {/* Interactive Touch Slider (Desktop V2 Parity) */}
          //                     <RangeSlider
          //                       min={2}
          //                       max={150}
          //                       value={form.distanceFilter?.maxDistance ?? 50}
          //                       unit="km"
          //                       prefix="Up to "
          //                       onValueChange={(val) =>
          //                         updateField("distanceFilter.maxDistance", val)
          //                       }
          //                     />
          //
          //                     <Text
          //                       style={[
          //                         styles.inputLabel,
          //                         { marginTop: 6, marginBottom: 6 },
          //                       ]}
          //                     >
          //                       Radius Presets
          //                     </Text>
          //                     <View style={styles.chipRow}>
          //                       {[
          //                         { dist: 10, label: "10 km" },
          //                         { dist: 25, label: "25 km" },
          //                         { dist: 50, label: "50 km" },
          //                         { dist: 100, label: "100 km" },
          //                         { dist: 150, label: "150 km" },
          //                       ].map((d) => {
          //                         const isActive =
          //                           (form.distanceFilter?.maxDistance ?? 50) === d.dist;
          //                         return (
          //                           <TouchableOpacity
          //                             accessibilityRole="button"
          //                             key={d.label}
          //                             style={[styles.chip, isActive && styles.chipActive]}
          //                             onPress={() =>
          //                               updateField("distanceFilter.maxDistance", d.dist)
          //                             }
          //                             activeOpacity={0.8}
          //                           >
          //                             <Text
          //                               style={[
          //                                 styles.chipText,
          //                                 isActive && styles.chipTextActive,
          //                               ]}
          //                             >
          //                               {d.label}
          //                             </Text>
          //                           </TouchableOpacity>
          //                         );
          //                       })}
          //                     </View>
          //                   </View>
          //                 )}
          //               </View>
          //
          //               {/* ─── Active Dating Location Capsule (Single Source of Truth in Settings) ─── */}
          //               <View style={styles.swipingLocationCapsule}>
          //                 <View style={styles.swipingLocationLeft}>
          //                   <View style={styles.swipingLocationTopRow}>
          //                     <Text style={styles.swipingLocationTitle}>
          //                       Dating Location
          //                     </Text>
          //                     <View
          //                       style={[
          //                         styles.swipingLocationBadge,
          //                         form?.useDeviceLocation
          //                           ? styles.swipingLocationBadgeGps
          //                           : styles.swipingLocationBadgePassport,
          //                       ]}
          //                     >
          //                       <Ionicons
          //                         name={form?.useDeviceLocation ? "navigate" : "airplane"}
          //                         size={10}
          //                         color={
          //                           form?.useDeviceLocation
          //                             ? uiTheme.colors.success
          //                             : uiTheme.colors.primary
          //                         }
          //                       />
          //                       <Text
          //                         style={[
          //                           styles.swipingLocationBadgeText,
          //                           form?.useDeviceLocation
          //                             ? { color: uiTheme.colors.success }
          //                             : { color: uiTheme.colors.primary },
          //                         ]}
          //                       >
          //                         {form?.useDeviceLocation ? "LIVE GPS" : "PASSPORT"}
          //                       </Text>
          //                     </View>
          //                   </View>
          //
          //                   <View style={styles.swipingLocationCityRow}>
          //                     <Text
          //                       style={styles.swipingLocationCityText}
          //                       numberOfLines={1}
          //                     >
          //                       {CITY_PRESETS.find((p) =>
          //                         (form?.locationCity || "").includes(p.short),
          //                       )?.flag || "📍"}{" "}
          //                       {form?.locationCity || "New York, USA"}
          //                     </Text>
          //                     <Text style={styles.swipingLocationSub}>
          //                       {form?.useDeviceLocation
          //                         ? "Matching near your physical phone location"
          //                         : "Matching in selected passport destination"}
          //                     </Text>
          //                   </View>
          //                 </View>
          //
          //                 <TouchableOpacity
          //                   accessibilityRole="button"
          //                   style={styles.swipingLocationActionBtn}
          //                   onPress={() => {
          //                     if (onNavigateToSettings) {
          //                       onNavigateToSettings("location");
          //                     }
          //                   }}
          //                   activeOpacity={0.8}
          //                 >
          //                   <Text style={styles.swipingLocationActionText}>Change</Text>
          //                   <Ionicons
          //                     name="arrow-forward"
          //                     size={12}
          //                     color={uiTheme.colors.primary}
          //                   />
          //                 </TouchableOpacity>
          //               </View>
          //             </View>
          //           )}
          //         </View>
        }

        {/* ════════════════════ CARD 3: MESSAGING (V2 DESKTOP PARITY) ════════════════════ */}
        {
          // <View style={[styles.v2Card, openCards.messaging && styles.v2CardOpen]}>
          //           <TouchableOpacity
          //             accessibilityRole="button"
          //             style={styles.v2CardHeader}
          //             onPress={() => toggleCard("messaging")}
          //             activeOpacity={0.85}
          //           >
          //             <View style={styles.cardTitleWrap}>
          //               <Ionicons name="chatbubbles-outline" size={17} color="#EC4899" />
          //               <Text style={styles.v2CardTitle}>Messaging</Text>
          //             </View>
          //             <Ionicons
          //               name={openCards.messaging ? "chevron-up" : "chevron-down"}
          //               size={18}
          //               color={uiTheme.colors.muted}
          //             />
          //           </TouchableOpacity>
          //
          //           {/* Collapsed Summary Chips */}
          //           {!openCards.messaging && (
          //             <View style={styles.collapsedRow}>
          //               <View style={styles.v2Chip}>
          //                 <Ionicons name="sparkles" size={11} color="#EC4899" />
          //                 <Text style={styles.v2ChipText}>
          //                   {getMessagingSummary().intention}
          //                 </Text>
          //               </View>
          //               <View style={styles.v2Chip}>
          //                 <Ionicons
          //                   name="swap-horizontal"
          //                   size={11}
          //                   color={uiTheme.colors.info}
          //                 />
          //                 <Text style={styles.v2ChipText}>
          //                   {getMessagingSummary().priority}
          //                 </Text>
          //               </View>
          //               <View style={styles.v2Chip}>
          //                 <Ionicons
          //                   name="color-wand"
          //                   size={11}
          //                   color={uiTheme.colors.success}
          //                 />
          //                 <Text style={styles.v2ChipText}>
          //                   {getMessagingSummary().tone}
          //                 </Text>
          //               </View>
          //               <View style={styles.v2Chip}>
          //                 <Ionicons
          //                   name="globe-outline"
          //                   size={11}
          //                   color={uiTheme.colors.warning}
          //                 />
          //                 <Text style={styles.v2ChipText}>
          //                   {getMessagingSummary().lang}
          //                 </Text>
          //               </View>
          //               <View style={styles.v2Chip}>
          //                 <Text style={styles.v2ChipText}>
          //                   {getMessagingSummary().emojis}
          //                 </Text>
          //               </View>
          //               {getMessagingSummary().consecutive && (
          //                 <View style={styles.v2Chip}>
          //                   <Text style={styles.v2ChipText}>Multi-text</Text>
          //                 </View>
          //               )}
          //             </View>
          //           )}
          //
          //           {/* Expanded Body */}
          //           {openCards.messaging && (
          //             <View style={styles.v2CardBody}>
          //               <Text style={styles.fieldDesc}>
          //                 Configure conversation style, intentions, language & priority
          //                 balancing:
          //               </Text>
          //
          //               {/* ─── Core Toggles (Smart Reactions, Use Emojis, Consecutive Messages) ─── */}
          //               <View style={styles.subBox}>
          //                 {/* Smart Reactions */}
          //                 <View style={styles.rowBetween}>
          //                   <View style={{ flex: 1, paddingRight: 10 }}>
          //                     <View
          //                       style={{
          //                         flexDirection: "row",
          //                         alignItems: "center",
          //                         gap: 6,
          //                       }}
          //                     >
          //                       <Text style={styles.toggleTitle}>Smart Reactions</Text>
          //                       <TouchableOpacity
          //                         accessibilityRole="button"
          //                         onPress={() =>
          //                           setTooltipModal({
          //                             title: "Smart Reactions",
          //                             lines: [
          //                               "① AI randomly likes (❤️) messages from matches",
          //                               "② Pushes your chat to the top of their inbox",
          //                               "③ Increases the chance they reply to you",
          //                             ],
          //                           })
          //                         }
          //                         hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          //                       >
          //                         <Ionicons
          //                           name="information-circle-outline"
          //                           size={14}
          //                           color={uiTheme.colors.muted}
          //                         />
          //                       </TouchableOpacity>
          //                     </View>
          //                     <Text style={styles.labelMuted}>
          //                       AI randomly likes (❤️) received messages to push chat to
          //                       top
          //                     </Text>
          //                   </View>
          //                   <Switch
          //                     value={
          //                       (form.randomHearts ?? form.smartReactionsEnabled) === true
          //                     }
          //                     onValueChange={(v) => {
          //                       updateField("randomHearts", v);
          //                       updateField("smartReactionsEnabled", v);
          //                     }}
          //                     trackColor={{
          //                       false: uiTheme.colors.elevated,
          //                       true: "#EC4899",
          //                     }}
          //                     thumbColor={
          //                       (form.randomHearts ?? form.smartReactionsEnabled)
          //                         ? "#FFF"
          //                         : uiTheme.colors.muted
          //                     }
          //                   />
          //                 </View>
          //
          //                 <View style={styles.subBoxDivider} />
          //
          //                 {/* Use Emoji's */}
          //                 <View style={styles.rowBetween}>
          //                   <View style={{ flex: 1, paddingRight: 10 }}>
          //                     <Text style={styles.toggleTitle}>Use Emoji's</Text>
          //                     <Text style={styles.labelMuted}>
          //                       Include expressive emojis in generated AI responses
          //                     </Text>
          //                   </View>
          //                   <Switch
          //                     value={form.useEmojis !== false}
          //                     onValueChange={(v) => updateField("useEmojis", v)}
          //                     trackColor={{
          //                       false: uiTheme.colors.elevated,
          //                       true: "#EC4899",
          //                     }}
          //                     thumbColor={
          //                       form.useEmojis !== false ? "#FFF" : uiTheme.colors.muted
          //                     }
          //                   />
          //                 </View>
          //
          //                 <View style={styles.subBoxDivider} />
          //
          //                 {/* Consecutive Messages (Double Texting) */}
          //                 <View style={styles.rowBetween}>
          //                   <View style={{ flex: 1, paddingRight: 10 }}>
          //                     <View
          //                       style={{
          //                         flexDirection: "row",
          //                         alignItems: "center",
          //                         gap: 6,
          //                       }}
          //                     >
          //                       <Text style={styles.toggleTitle}>
          //                         Consecutive Messages
          //                       </Text>
          //                       <TouchableOpacity
          //                         accessibilityRole="button"
          //                         onPress={() =>
          //                           setTooltipModal({
          //                             title: "Consecutive Messages",
          //                             lines: [
          //                               "① Match sends multiple messages in a row",
          //                               "② AI mirrors their energy with 2–3 replies back",
          //                               "③ Each part uses 1 message credit",
          //                             ],
          //                           })
          //                         }
          //                         hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          //                       >
          //                         <Ionicons
          //                           name="information-circle-outline"
          //                           size={14}
          //                           color={uiTheme.colors.muted}
          //                         />
          //                       </TouchableOpacity>
          //                     </View>
          //                     <Text style={styles.labelMuted}>
          //                       AI mirrors match energy with 2–3 message replies when they
          //                       text in bursts
          //                     </Text>
          //                   </View>
          //                   <Switch
          //                     value={form.consecutiveMessagesEnabled === true}
          //                     onValueChange={(v) =>
          //                       updateField("consecutiveMessagesEnabled", v)
          //                     }
          //                     trackColor={{
          //                       false: uiTheme.colors.elevated,
          //                       true: "#EC4899",
          //                     }}
          //                     thumbColor={
          //                       form.consecutiveMessagesEnabled
          //                         ? "#FFF"
          //                         : uiTheme.colors.muted
          //                     }
          //                   />
          //                 </View>
          //               </View>
          //
          //               {/* ─── Your Intentions Dropdown (V2 UI Parity) ─── */}
          //               <View style={styles.subBox}>
          //                 <V2Dropdown
          //                   label="Your Intentions"
          //                   options={INTENTIONS_OPTIONS.map((item) => ({
          //                     id: item.id,
          //                     value: item.id,
          //                     label: item.label,
          //                   }))}
          //                   selectedValue={form.intentions || "short_term"}
          //                   onSelect={(val) => updateField("intentions", val)}
          //                 />
          //               </View>
          //
          //               {/* ─── Conversation Tone Dropdown (V2 UI Parity) ─── */}
          //               <View style={styles.subBox}>
          //                 <V2Dropdown
          //                   label="Conversation Tone"
          //                   options={TONE_OPTIONS.map((t) => ({
          //                     id: t.toLowerCase(),
          //                     value: t.toLowerCase(),
          //                     label: t,
          //                   }))}
          //                   selectedValue={(
          //                     form.tone ||
          //                     form.chattingStyle ||
          //                     "freestyle"
          //                   ).toLowerCase()}
          //                   onSelect={(val) => {
          //                     const titleCased =
          //                       val.charAt(0).toUpperCase() + val.slice(1);
          //                     updateField("tone", titleCased);
          //                     updateField("chattingStyle", val);
          //                   }}
          //                 />
          //               </View>
          //
          //               {/* ─── Default Language Dropdown (V2 UI Parity) ─── */}
          //               <View style={styles.subBox}>
          //                 <V2Dropdown
          //                   label="Default Language"
          //                   sublabel="(Editable per match)"
          //                   options={LANGUAGE_OPTIONS.map((lang) => ({
          //                     id: lang.code,
          //                     value: lang.code,
          //                     label: lang.label,
          //                     flag: lang.flag,
          //                   }))}
          //                   selectedValue={form.conversationLanguage || "en"}
          //                   onSelect={(val) => updateField("conversationLanguage", val)}
          //                 />
          //               </View>
          //
          //               {/* ─── Messaging Priority (Replies vs New Matches) ─── */}
          //               <View style={styles.subBox}>
          //                 <View
          //                   style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          //                 >
          //                   <Text style={styles.subBoxTitle}>
          //                     Messaging Priority{" "}
          //                     <Text
          //                       style={{
          //                         fontFamily: "Inter_400Regular",
          //                         color: uiTheme.colors.muted,
          //                         fontSize: 11,
          //                         fontWeight: "normal",
          //                       }}
          //                     >
          //                       (Replies : New Matches)
          //                     </Text>
          //                   </Text>
          //                   <TouchableOpacity
          //                     accessibilityRole="button"
          //                     onPress={() =>
          //                       setTooltipModal({
          //                         title: "Messaging Priority",
          //                         lines: [
          //                           "Splits AI time between replies & new outreach",
          //                           "⬅ 70:30 → mostly replies to current chats",
          //                           "⬛ 50:50 → balanced (recommended)",
          //                           "➡ 30:70 → aggressively messages new matches",
          //                         ],
          //                       })
          //                     }
          //                     hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          //                   >
          //                     <Ionicons
          //                       name="information-circle-outline"
          //                       size={14}
          //                       color={uiTheme.colors.muted}
          //                     />
          //                   </TouchableOpacity>
          //                 </View>
          //                 <Text style={[styles.labelMuted, { marginBottom: 8 }]}>
          //                   Splits AI time between ongoing conversation replies & new
          //                   match outreach:
          //                 </Text>
          //
          //                 <View style={styles.speedButtonGroup}>
          //                   {PRIORITY_PRESETS.map((preset) => {
          //                     const currentVal =
          //                       form.prioritySlider ?? form.minReplySlots ?? 50;
          //                     const isSelected = currentVal === preset.value;
          //                     return (
          //                       <TouchableOpacity
          //                         accessibilityRole="button"
          //                         key={preset.value}
          //                         style={[
          //                           styles.speedBtn,
          //                           isSelected && styles.speedBtnActive,
          //                         ]}
          //                         onPress={() => {
          //                           updateField("prioritySlider", preset.value);
          //                           updateField(
          //                             "minReplySlots",
          //                             preset.value === 30
          //                               ? 70
          //                               : preset.value === 70
          //                                 ? 30
          //                                 : 50,
          //                           );
          //                           updateField(
          //                             "maxNewMatchSlots",
          //                             preset.value === 30
          //                               ? 30
          //                               : preset.value === 70
          //                                 ? 70
          //                                 : 50,
          //                           );
          //                         }}
          //                         activeOpacity={0.8}
          //                       >
          //                         <Text
          //                           style={[
          //                             styles.speedBtnText,
          //                             isSelected && styles.speedBtnTextActive,
          //                           ]}
          //                         >
          //                           {preset.ratio}
          //                         </Text>
          //                       </TouchableOpacity>
          //                     );
          //                   })}
          //                 </View>
          //
          //                 <View style={{ marginTop: 8 }}>
          //                   <Text
          //                     style={{
          //                       fontFamily: "Inter_600SemiBold",
          //                       color: uiTheme.colors.primary,
          //                       fontSize: 11,
          //                       fontWeight: "normal",
          //                     }}
          //                   >
          //                     {PRIORITY_PRESETS.find(
          //                       (p) =>
          //                         p.value ===
          //                         (form.prioritySlider ?? form.minReplySlots ?? 50),
          //                     )?.desc || "Balanced outreach & replies (Recommended)"}
          //                   </Text>
          //                 </View>
          //               </View>
          //             </View>
          //           )}
          //         </View>
        }

        {/* ════════════════════ CARD 4: YOUR CHAT STYLE & AI TRAINING (V2 DESKTOP PARITY) ════════════════════ */}
        {
          // <View style={[styles.v2Card, openCards.style && styles.v2CardOpen]}>
          //           <TouchableOpacity
          //             accessibilityRole="button"
          //             style={styles.v2CardHeader}
          //             onPress={() => toggleCard("style")}
          //             activeOpacity={0.85}
          //           >
          //             <View style={styles.cardTitleWrap}>
          //               <Ionicons name="sparkles-outline" size={17} color="#C026D3" />
          //               <Text style={styles.v2CardTitle}>Your Chat Style</Text>
          //             </View>
          //             <Ionicons
          //               name={openCards.style ? "chevron-up" : "chevron-down"}
          //               size={18}
          //               color={uiTheme.colors.muted}
          //             />
          //           </TouchableOpacity>
          //
          //           {/* Collapsed Summary Chips */}
          //           {!openCards.style && (
          //             <View style={styles.collapsedRow}>
          //               {getStyleSummary().map((item, idx) => (
          //                 <View
          //                   key={idx}
          //                   style={[
          //                     styles.v2Chip,
          //                     item.full && { borderColor: "rgba(192, 38, 211, 0.4)" },
          //                   ]}
          //                 >
          //                   <Ionicons name="sparkles" size={11} color="#C026D3" />
          //                   <Text
          //                     style={[
          //                       styles.v2ChipText,
          //                       item.full && { color: uiTheme.colors.text },
          //                     ]}
          //                   >
          //                     {item.label}
          //                   </Text>
          //                 </View>
          //               ))}
          //             </View>
          //           )}
          //
          //           {/* Expanded Body */}
          //           {openCards.style && (
          //             <View style={styles.v2CardBody}>
          //               {/* ─── SCREEN 1: INTRO / OVERVIEW ─── */}
          //               {styleView === "intro" &&
          //                 (() => {
          //                   const profiles = form?.chatStyleProfiles || {};
          //                   const legacy = form?.chatStyleProfile;
          //                   if (
          //                     legacy?.trained &&
          //                     !profiles[legacy.trainingLanguage || "en"]
          //                   ) {
          //                     profiles[legacy.trainingLanguage || "en"] = legacy;
          //                   }
          //                   const activeProfile = profiles[trainingLang];
          //                   const isTrained = !!activeProfile?.trained;
          //                   const isFull = isTrained && !activeProfile?.partial;
          //                   const currentLangObj = LANGUAGE_OPTIONS.find(
          //                     (l) => l.code === trainingLang,
          //                   ) || { label: "English", flag: "🇺🇸" };
          //                   const trainedCodes = Object.keys(profiles).filter(
          //                     (k) => profiles[k]?.trained,
          //                   );
          //
          //                   const maxProfiles =
          //                     form?.remoteStyleTrainingConfig?.maxProfiles ?? 3;
          //                   const atCap =
          //                     !isTrained && trainedCodes.length >= maxProfiles;
          //
          //                   return (
          //                     <View style={styles.cstIntroContainer}>
          //                       <View style={styles.cstIntroIconWrap}>
          //                         <Ionicons
          //                           name="chatbubbles"
          //                           size={24}
          //                           color="#C026D3"
          //                         />
          //                       </View>
          //
          //                       <Text style={styles.cstIntroTitle}>
          //                         {atCap
          //                           ? "Profile Limit Reached"
          //                           : isFull
          //                             ? `Retrain for ${currentLangObj.label}`
          //                             : isTrained
          //                               ? `Continue training ${currentLangObj.label}`
          //                               : "Train Your Chat Style"}
          //                       </Text>
          //
          //                       <Text style={styles.cstIntroDesc}>
          //                         {atCap
          //                           ? `You have ${trainedCodes.length} trained profiles (the maximum). Delete one from your existing profiles to train a new language.`
          //                           : isFull
          //                             ? `You have a complete style profile for ${currentLangObj.label}. Start a new session to update your texting rhythm.`
          //                             : isTrained
          //                               ? `Your ${currentLangObj.label} profile has ${activeProfile.messageCount || 0} messages — 12 messages gives the highest AI accuracy.`
          //                               : "Reply to a few messages from a practice match. The AI learns how you write so when it messages your matches, it uses your tone, your words and your rhythm."}
          //                       </Text>
          //
          //                       {/* Trained Languages Bar */}
          //                       {trainedCodes.length > 0 && (
          //                         <View style={styles.cstTrainedBar}>
          //                           <Text style={styles.cstTrainedBarLabel}>
          //                             Trained Languages ({trainedCodes.length}/
          //                             {maxProfiles}):
          //                           </Text>
          //                           <View style={styles.cstTrainedChipsRow}>
          //                             {trainedCodes.map((code) => {
          //                               const p = profiles[code];
          //                               const lObj = LANGUAGE_OPTIONS.find(
          //                                 (l) => l.code === code,
          //                               ) || { label: code, flag: "🌐" };
          //                               const isActive = code === trainingLang;
          //                               return (
          //                                 <TouchableOpacity
          //                                   accessibilityRole="button"
          //                                   key={code}
          //                                   style={[
          //                                     styles.cstTrainedPill,
          //                                     isActive && styles.cstTrainedPillActive,
          //                                   ]}
          //                                   onPress={() => {
          //                                     setViewingLang(code);
          //                                     setStyleView("insights");
          //                                   }}
          //                                   activeOpacity={0.8}
          //                                 >
          //                                   <Text
          //                                     style={[
          //                                       styles.cstTrainedPillText,
          //                                       isActive &&
          //                                         styles.cstTrainedPillTextActive,
          //                                     ]}
          //                                   >
          //                                     {p.partial
          //                                       ? `${lObj.flag} ${lObj.label} ${p.messageCount || 0}/12`
          //                                       : `✓ ${lObj.flag} ${lObj.label}`}
          //                                   </Text>
          //                                 </TouchableOpacity>
          //                               );
          //                             })}
          //                           </View>
          //                         </View>
          //                       )}
          //
          //                       {/* Training Language Dropdown */}
          //                       <View style={{ marginTop: 12 }}>
          //                         <V2Dropdown
          //                           label="Training language"
          //                           options={LANGUAGE_OPTIONS.map((l) => ({
          //                             id: l.code,
          //                             value: l.code,
          //                             label: l.label,
          //                             flag: l.flag,
          //                           }))}
          //                           selectedValue={trainingLang}
          //                           onSelect={(val) => setTrainingLang(val)}
          //                         />
          //                       </View>
          //
          //                       {/* Start / Continue Button */}
          //                       <TouchableOpacity
          //                         accessibilityRole="button"
          //                         style={[
          //                           styles.cstStartBtn,
          //                           atCap && { opacity: 0.5, backgroundColor: "#332E4A" },
          //                         ]}
          //                         onPress={() =>
          //                           !atCap && startTrainingSession(trainingLang, isFull)
          //                         }
          //                         disabled={atCap}
          //                         activeOpacity={0.85}
          //                       >
          //                         <Ionicons
          //                           name={atCap ? "alert-circle" : "sparkles"}
          //                           size={15}
          //                           color="#FFF"
          //                         />
          //                         <Text style={styles.cstStartBtnText}>
          //                           {atCap
          //                             ? `Profile Limit Reached (Max ${maxProfiles})`
          //                             : isFull
          //                               ? `Retrain ${currentLangObj.label}`
          //                               : isTrained
          //                                 ? `Continue Training ${currentLangObj.label}`
          //                                 : `Start Training (${currentLangObj.label})`}
          //                         </Text>
          //                       </TouchableOpacity>
          //
          //                       {/* View Trained Style Button */}
          //                       {isTrained && (
          //                         <TouchableOpacity
          //                           accessibilityRole="button"
          //                           style={styles.cstViewTrainedBtn}
          //                           onPress={() => {
          //                             setViewingLang(trainingLang);
          //                             setStyleView("insights");
          //                           }}
          //                           activeOpacity={0.8}
          //                         >
          //                           <Text style={styles.cstViewTrainedBtnText}>
          //                             View trained style profile
          //                           </Text>
          //                         </TouchableOpacity>
          //                       )}
          //                     </View>
          //                   );
          //                 })()}
          //
          //               {/* ─── SCREEN 2: SIMULATOR CHAT (V2 DESKTOP PARITY) ─── */}
          //               {styleView === "chat" &&
          //                 (() => {
          //                   const validCount = chatMessages.filter(
          //                     (m) => m.sender === "user" && !m.garbage,
          //                   ).length;
          //                   const progressPct = Math.min((validCount / 12) * 100, 100);
          //                   const currentLangObj = LANGUAGE_OPTIONS.find(
          //                     (l) => l.code === trainingLang,
          //                   ) || { label: "English", flag: "🇺🇸" };
          //                   const persona = getPersonaForLang(trainingLang);
          //                   const profiles = form?.chatStyleProfiles || {};
          //                   const trainedCodes = Object.keys(profiles).filter(
          //                     (k) => profiles[k]?.trained,
          //                   );
          //
          //                   return (
          //                     <View style={styles.cstSimContainer}>
          //                       {/* Top Simulator Header */}
          //                       <View style={styles.cstSimTopBar}>
          //                         <View
          //                           style={{
          //                             flexDirection: "row",
          //                             alignItems: "center",
          //                             gap: 10,
          //                           }}
          //                         >
          //                           <View style={styles.simAvatarWrapper}>
          //                             <View style={styles.simAvatar}>
          //                               <Text
          //                                 style={{
          //                                   fontFamily: "Inter_700Bold",
          //                                   color: "#FFF",
          //                                   fontWeight: "normal",
          //                                   fontSize: 12,
          //                                 }}
          //                               >
          //                                 {persona.name.charAt(0)}
          //                               </Text>
          //                             </View>
          //                             <View style={styles.simAvatarOnlineDot} />
          //                           </View>
          //                           <View>
          //                             <Text style={styles.simMatchName}>
          //                               {persona.name}
          //                             </Text>
          //                             <Text
          //                               style={{
          //                                 fontFamily: "Inter_600SemiBold",
          //                                 color: uiTheme.colors.success,
          //                                 fontSize: 11,
          //                                 fontWeight: "normal",
          //                               }}
          //                             >
          //                               Online now
          //                             </Text>
          //                           </View>
          //                         </View>
          //
          //                         <View
          //                           style={{
          //                             flexDirection: "row",
          //                             alignItems: "center",
          //                             gap: 8,
          //                           }}
          //                         >
          //                           <View
          //                             style={{
          //                               width: 60,
          //                               height: 4,
          //                               backgroundColor: "#221E33",
          //                               borderRadius: 2,
          //                               overflow: "hidden",
          //                             }}
          //                           >
          //                             <View
          //                               style={{
          //                                 width: `${progressPct}%`,
          //                                 height: "100%",
          //                                 backgroundColor: uiTheme.colors.primary,
          //                                 borderRadius: 2,
          //                               }}
          //                             />
          //                           </View>
          //                           <Text
          //                             style={{
          //                               fontFamily: "Inter_700Bold",
          //                               color: uiTheme.colors.muted,
          //                               fontSize: 11,
          //                               fontWeight: "normal",
          //                             }}
          //                           >
          //                             {validCount} / 12
          //                           </Text>
          //                           <TouchableOpacity
          //                             accessibilityRole="button"
          //                             style={styles.cstRestartBtn}
          //                             onPress={restartTrainingSession}
          //                             activeOpacity={0.8}
          //                             accessibilityLabel="Restart"
          //                           >
          //                             <Ionicons
          //                               name="refresh"
          //                               size={13}
          //                               color={uiTheme.colors.muted}
          //                             />
          //                           </TouchableOpacity>
          //                           <TouchableOpacity
          //                             accessibilityRole="button"
          //                             style={styles.cstCancelBtn}
          //                             onPress={() => setStyleView("intro")}
          //                             activeOpacity={0.8}
          //                           >
          //                             <Ionicons
          //                               name="close"
          //                               size={15}
          //                               color={uiTheme.colors.muted}
          //                             />
          //                           </TouchableOpacity>
          //                         </View>
          //                       </View>
          //
          //                       {/* Messages Container */}
          //                       <ScrollView
          //                         style={styles.cstMessagesScroll}
          //                         contentContainerStyle={{ gap: 10, paddingVertical: 8 }}
          //                         showsVerticalScrollIndicator={false}
          //                       >
          //                         {/* Date Separator */}
          //                         <View style={styles.simDateSeparator}>
          //                           <Text style={styles.simDateSeparatorText}>TODAY</Text>
          //                         </View>
          //
          //                         {chatMessages.map((msg) => {
          //                           if (msg.sender === "system") {
          //                             return (
          //                               <View key={msg.id} style={styles.simSystemHint}>
          //                                 <Ionicons
          //                                   name="information-circle-outline"
          //                                   size={13}
          //                                   color={uiTheme.colors.warning}
          //                                 />
          //                                 <Text style={styles.simSystemHintText}>
          //                                   {msg.text}
          //                                 </Text>
          //                               </View>
          //                             );
          //                           }
          //                           if (msg.sender === "match") {
          //                             return (
          //                               <View key={msg.id} style={styles.simMatchRow}>
          //                                 <View style={styles.simMatchAvatarTiny}>
          //                                   <Text
          //                                     style={{
          //                                       fontFamily: "Inter_800ExtraBold",
          //                                       color: "#FFF",
          //                                       fontSize: 10,
          //                                       fontWeight: "normal",
          //                                     }}
          //                                   >
          //                                     {persona.name.charAt(0)}
          //                                   </Text>
          //                                 </View>
          //                                 <View
          //                                   style={[
          //                                     styles.simBubble,
          //                                     styles.simBubbleMatch,
          //                                   ]}
          //                                 >
          //                                   <Text style={styles.simBubbleTextMatch}>
          //                                     {msg.text}
          //                                   </Text>
          //                                 </View>
          //                               </View>
          //                             );
          //                           }
          //                           return (
          //                             <View
          //                               key={msg.id}
          //                               style={[
          //                                 styles.simBubble,
          //                                 styles.simBubbleUser,
          //                                 msg.garbage && {
          //                                   backgroundColor: "rgba(239, 68, 68, 0.2)",
          //                                   borderWidth: 1,
          //                                   borderColor: "rgba(239, 68, 68, 0.4)",
          //                                 },
          //                               ]}
          //                             >
          //                               <Text style={styles.simBubbleTextUser}>
          //                                 {msg.text}
          //                               </Text>
          //                             </View>
          //                           );
          //                         })}
          //                         {calibrating && (
          //                           <View style={styles.simMatchRow}>
          //                             <View style={styles.simMatchAvatarTiny}>
          //                               <Text
          //                                 style={{
          //                                   fontFamily: "Inter_800ExtraBold",
          //                                   color: "#FFF",
          //                                   fontSize: 10,
          //                                   fontWeight: "normal",
          //                                 }}
          //                               >
          //                                 {persona.name.charAt(0)}
          //                               </Text>
          //                             </View>
          //                             <View
          //                               style={[styles.simBubble, styles.simBubbleMatch]}
          //                             >
          //                               <Text
          //                                 style={{
          //                                   fontFamily: "Inter_400Regular",
          //                                   color: uiTheme.colors.muted,
          //                                   fontSize: 11,
          //                                   fontStyle: "italic",
          //                                 }}
          //                               >
          //                                 {persona.name} is typing…
          //                               </Text>
          //                             </View>
          //                           </View>
          //                         )}
          //
          //                         {/* Desktop V2 Finish Banner */}
          //                         {sessionCompleted && (
          //                           <View style={styles.cstFinishBanner}>
          //                             <Text
          //                               style={{
          //                                 fontFamily: "Inter_400Regular",
          //                                 fontSize: 22,
          //                                 textAlign: "center",
          //                                 marginBottom: 4,
          //                               }}
          //                             >
          //                               🎉
          //                             </Text>
          //                             <Text style={styles.cstFinishTitle}>
          //                               Training complete!
          //                             </Text>
          //                             <Text style={styles.cstFinishSub}>
          //                               Your style has been captured. Tap below to see
          //                               what the AI learned.
          //                             </Text>
          //                             <TouchableOpacity
          //                               accessibilityRole="button"
          //                               style={styles.cstFinishBtn}
          //                               onPress={finishAndSaveSession}
          //                               activeOpacity={0.85}
          //                             >
          //                               <Text style={styles.cstFinishBtnText}>
          //                                 See Results
          //                               </Text>
          //                             </TouchableOpacity>
          //                           </View>
          //                         )}
          //                       </ScrollView>
          //
          //                       {/* Footer Action Row with Globe Pill */}
          //                       <View style={styles.simActionRow}>
          //                         {validCount > 0 && !sessionCompleted && (
          //                           <TouchableOpacity
          //                             accessibilityRole="button"
          //                             style={[
          //                               styles.cstSaveInlinePill,
          //                               inlineSaved && {
          //                                 borderColor: uiTheme.colors.success,
          //                                 backgroundColor: "rgba(16, 185, 129, 0.12)",
          //                               },
          //                             ]}
          //                             onPress={saveStyleInline}
          //                             activeOpacity={0.8}
          //                           >
          //                             <Text
          //                               style={[
          //                                 styles.cstSaveInlinePillText,
          //                                 inlineSaved && {
          //                                   color: uiTheme.colors.success,
          //                                 },
          //                               ]}
          //                             >
          //                               {inlineSaved ? "✓ Saved" : "Save style"}
          //                             </Text>
          //                           </TouchableOpacity>
          //                         )}
          //                         <View style={{ flex: 1 }} />
          //                         {trainedCodes.length > 0 && (
          //                           <TouchableOpacity
          //                             accessibilityRole="button"
          //                             style={styles.cstProfilesBtn}
          //                             onPress={() => setSimLangModalOpen(true)}
          //                             activeOpacity={0.8}
          //                           >
          //                             <Ionicons
          //                               name="person-circle-outline"
          //                               size={13}
          //                               color="#C026D3"
          //                             />
          //                             <Text style={styles.cstProfilesBtnText}>
          //                               Profiles {trainedCodes.length}
          //                             </Text>
          //                           </TouchableOpacity>
          //                         )}
          //                         <TouchableOpacity
          //                           accessibilityRole="button"
          //                           style={styles.simLangPill}
          //                           onPress={() => setSimLangModalOpen(true)}
          //                           activeOpacity={0.8}
          //                         >
          //                           <Ionicons
          //                             name="globe-outline"
          //                             size={12}
          //                             color={uiTheme.colors.primary}
          //                           />
          //                           <Text style={styles.simLangPillText}>
          //                             {currentLangObj.label}
          //                           </Text>
          //                           <Ionicons
          //                             name="chevron-down"
          //                             size={12}
          //                             color={uiTheme.colors.primary}
          //                           />
          //                         </TouchableOpacity>
          //                       </View>
          //
          //                       {/* Simulator Language Selection Modal */}
          //                       <Modal
          //                         visible={simLangModalOpen}
          //                         transparent
          //                         animationType="fade"
          //                         onRequestClose={() => setSimLangModalOpen(false)}
          //                       >
          //                         <TouchableOpacity
          //                           accessibilityRole="button"
          //                           style={styles.modalOverlay}
          //                           activeOpacity={1}
          //                           onPress={() => setSimLangModalOpen(false)}
          //                         >
          //                           <View
          //                             style={styles.simLangModalContent}
          //                             onStartShouldSetResponder={() => true}
          //                           >
          //                             <View style={styles.simLangModalHeader}>
          //                               <Text style={styles.simLangModalTitle}>
          //                                 Training Language
          //                               </Text>
          //                               <TouchableOpacity
          //                                 accessibilityRole="button"
          //                                 onPress={() => setSimLangModalOpen(false)}
          //                                 hitSlop={{
          //                                   top: 8,
          //                                   bottom: 8,
          //                                   left: 8,
          //                                   right: 8,
          //                                 }}
          //                               >
          //                                 <Ionicons
          //                                   name="close"
          //                                   size={18}
          //                                   color={uiTheme.colors.muted}
          //                                 />
          //                               </TouchableOpacity>
          //                             </View>
          //
          //                             <ScrollView
          //                               style={{ maxHeight: 320 }}
          //                               showsVerticalScrollIndicator={false}
          //                             >
          //                               {LANGUAGE_OPTIONS.map((lang) => {
          //                                 const isSelected = lang.code === trainingLang;
          //                                 const isTrained =
          //                                   !!form?.chatStyleProfiles?.[lang.code]
          //                                     ?.trained;
          //                                 const isPartial =
          //                                   !!form?.chatStyleProfiles?.[lang.code]
          //                                     ?.partial;
          //                                 const count =
          //                                   form?.chatStyleProfiles?.[lang.code]
          //                                     ?.messageCount || 0;
          //
          //                                 return (
          //                                   <TouchableOpacity
          //                                     accessibilityRole="button"
          //                                     key={lang.code}
          //                                     style={[
          //                                       styles.simLangModalOption,
          //                                       isSelected &&
          //                                         styles.simLangModalOptionSelected,
          //                                     ]}
          //                                     onPress={() =>
          //                                       handleSwitchSimLanguage(lang.code)
          //                                     }
          //                                     activeOpacity={0.7}
          //                                   >
          //                                     <View
          //                                       style={{
          //                                         flexDirection: "row",
          //                                         alignItems: "center",
          //                                         gap: 10,
          //                                       }}
          //                                     >
          //                                       <Text
          //                                         style={{
          //                                           fontFamily: "Inter_400Regular",
          //                                           fontSize: 18,
          //                                         }}
          //                                       >
          //                                         {lang.flag}
          //                                       </Text>
          //                                       <View>
          //                                         <Text
          //                                           style={[
          //                                             styles.simLangModalOptionText,
          //                                             isSelected && {
          //                                               fontFamily: "Inter_800ExtraBold",
          //                                               color: uiTheme.colors.primary,
          //                                               fontWeight: "normal",
          //                                             },
          //                                           ]}
          //                                         >
          //                                           {lang.label}
          //                                         </Text>
          //                                         {isTrained && (
          //                                           <Text
          //                                             style={{
          //                                               fontFamily: "Inter_600SemiBold",
          //                                               color: isPartial
          //                                                 ? uiTheme.colors.warning
          //                                                 : uiTheme.colors.success,
          //                                               fontSize: 10,
          //                                               fontWeight: "normal",
          //                                             }}
          //                                           >
          //                                             {isPartial
          //                                               ? `Partial session (${count}/12)`
          //                                               : "✓ Style trained"}
          //                                           </Text>
          //                                         )}
          //                                       </View>
          //                                     </View>
          //
          //                                     {isSelected && (
          //                                       <Ionicons
          //                                         name="checkmark-circle"
          //                                         size={18}
          //                                         color={uiTheme.colors.primary}
          //                                       />
          //                                     )}
          //                                   </TouchableOpacity>
          //                                 );
          //                               })}
          //                             </ScrollView>
          //                           </View>
          //                         </TouchableOpacity>
          //                       </Modal>
          //
          //                       {/* Practice Input Bar */}
          //                       <View style={{ marginTop: 4 }}>
          //                         <View style={styles.simInputRow}>
          //                           <TextInput
          //                             style={[
          //                               styles.simTextInput,
          //                               inputShaking && styles.simTextInputShaking,
          //                               sessionCompleted && { opacity: 0.5 },
          //                             ]}
          //                             placeholder={
          //                               sessionCompleted
          //                                 ? "Training complete"
          //                                 : "Type your reply..."
          //                             }
          //                             placeholderTextColor="#55526B"
          //                             value={inputPracticeMsg}
          //                             onChangeText={(text) => {
          //                               setInputPracticeMsg(text);
          //                               if (inputWarning) setInputWarning("");
          //                               if (inputShaking) setInputShaking(false);
          //                             }}
          //                             onSubmitEditing={sendPracticeMessage}
          //                             editable={!sessionCompleted}
          //                           />
          //                           <TouchableOpacity
          //                             accessibilityRole="button"
          //                             style={[
          //                               styles.simSendBtn,
          //                               sessionCompleted && { opacity: 0.4 },
          //                             ]}
          //                             onPress={sendPracticeMessage}
          //                             activeOpacity={0.8}
          //                             disabled={sessionCompleted}
          //                           >
          //                             <Ionicons
          //                               name="arrow-forward"
          //                               size={16}
          //                               color="#FFF"
          //                             />
          //                           </TouchableOpacity>
          //                         </View>
          //
          //                         {/* Desktop V2 Bottom Orange Warning Message */}
          //                         {!!inputWarning && (
          //                           <Text style={styles.simInputWarningText}>
          //                             {inputWarning}
          //                           </Text>
          //                         )}
          //                       </View>
          //                     </View>
          //                   );
          //                 })()}
          //
          //               {/* ─── SCREEN 3: TRAINED STYLE INSIGHTS & COMPLETION (V2 DESKTOP PARITY) ─── */}
          //               {styleView === "insights" &&
          //                 (() => {
          //                   const profiles = form?.chatStyleProfiles || {};
          //                   const profile =
          //                     profiles[viewingLang] || form?.chatStyleProfile || {};
          //                   const langObj = LANGUAGE_OPTIONS.find(
          //                     (l) => l.code === viewingLang,
          //                   ) || { label: "English", flag: "🇺🇸" };
          //                   const isPartial = !!profile.partial;
          //                   const hasSavedChat =
          //                     (profile.savedMessages &&
          //                       profile.savedMessages.length > 0) ||
          //                     chatMessages.length > 1;
          //
          //                   return (
          //                     <View style={styles.cstInsightsContainer}>
          //                       <View style={styles.cstInsightsHeader}>
          //                         <View
          //                           style={[
          //                             styles.cstBadgeSuccess,
          //                             isPartial && {
          //                               backgroundColor: "rgba(245, 158, 11, 0.15)",
          //                               borderColor: "rgba(245, 158, 11, 0.3)",
          //                             },
          //                           ]}
          //                         >
          //                           <Ionicons
          //                             name={
          //                               isPartial ? "time-outline" : "checkmark-circle"
          //                             }
          //                             size={14}
          //                             color={
          //                               isPartial
          //                                 ? uiTheme.colors.warning
          //                                 : uiTheme.colors.success
          //                             }
          //                           />
          //                           <Text
          //                             style={[
          //                               styles.cstBadgeSuccessText,
          //                               isPartial && { color: uiTheme.colors.warning },
          //                             ]}
          //                           >
          //                             {isPartial
          //                               ? "Partial Style Saved"
          //                               : "Style Captured"}
          //                           </Text>
          //                         </View>
          //                         <Text style={styles.cstInsightsTitle}>
          //                           {langObj.flag} {langObj.label} Style Profile
          //                         </Text>
          //                         <Text style={styles.cstInsightsSub}>
          //                           {isPartial
          //                             ? `${profile.messageCount || 0} of 12 messages trained · more training improves accuracy.`
          //                             : `Trained on ${profile.messageCount || 12} messages. Your AI Wingman writes in this style in ${langObj.label}.`}
          //                         </Text>
          //                       </View>
          //
          //                       {/* Trait Chips Bar (Desktop V2 .cst-traits) */}
          //                       <View style={styles.cstTraitsRow}>
          //                         <View style={styles.cstTraitChip}>
          //                           <Text style={styles.cstTraitChipText}>
          //                             {profile.aiSummary?.lengthTrait ||
          //                               (profile.aiSummary?.avgWords <= 6
          //                                 ? "Short messages"
          //                                 : profile.aiSummary?.avgWords >= 14
          //                                   ? "Detailed messages"
          //                                   : "Medium messages")}
          //                           </Text>
          //                         </View>
          //                         <View style={styles.cstTraitChip}>
          //                           <Text style={styles.cstTraitChipText}>
          //                             {profile.aiSummary?.emojiTrait ||
          //                               (profile.aiSummary?.emojiPct === 0
          //                                 ? "No emoji"
          //                                 : profile.aiSummary?.emojiPct > 45
          //                                   ? "Heavy emoji"
          //                                   : "Light emoji")}
          //                           </Text>
          //                         </View>
          //                         <View style={styles.cstTraitChip}>
          //                           <Text style={styles.cstTraitChipText}>
          //                             {profile.aiSummary?.toneTrait ||
          //                               (profile.aiSummary?.isLowercase
          //                                 ? "Playful & casual"
          //                                 : "Casual tone")}
          //                           </Text>
          //                         </View>
          //                         <View style={styles.cstTraitChip}>
          //                           <Text style={styles.cstTraitChipText}>
          //                             {profile.aiSummary?.followUpTrait || "Natural flow"}
          //                           </Text>
          //                         </View>
          //                       </View>
          //
          //                       {/* What the AI Noticed Summary Box (Desktop V2 .cst-ai-summary-wrap) */}
          //                       {profile.aiSummary?.whatAiNoticed && (
          //                         <View style={styles.cstAiSummaryWrap}>
          //                           <Text style={styles.cstAiSummaryLabel}>
          //                             What the AI noticed
          //                           </Text>
          //                           <Text style={styles.cstAiSummaryText}>
          //                             {profile.aiSummary.whatAiNoticed}
          //                           </Text>
          //                         </View>
          //                       )}
          //
          //                       {/* Metric Cards Breakdown */}
          //                       <View style={styles.cstMetricGrid}>
          //                         <View style={styles.cstMetricCard}>
          //                           <View
          //                             style={{
          //                               flexDirection: "row",
          //                               alignItems: "center",
          //                               gap: 6,
          //                             }}
          //                           >
          //                             <Ionicons
          //                               name="speedometer-outline"
          //                               size={14}
          //                               color={uiTheme.colors.primary}
          //                             />
          //                             <Text style={styles.cstMetricTitle}>
          //                               Texting Tempo & Length
          //                             </Text>
          //                           </View>
          //                           <Text style={styles.cstMetricValue}>
          //                             {profile.aiSummary?.tempoDesc ||
          //                               "Balanced & Natural (avg 7–12 words)"}
          //                           </Text>
          //                         </View>
          //
          //                         <View style={styles.cstMetricCard}>
          //                           <View
          //                             style={{
          //                               flexDirection: "row",
          //                               alignItems: "center",
          //                               gap: 6,
          //                             }}
          //                           >
          //                             <Ionicons
          //                               name="happy-outline"
          //                               size={14}
          //                               color="#EC4899"
          //                             />
          //                             <Text style={styles.cstMetricTitle}>
          //                               Emoji Placement
          //                             </Text>
          //                           </View>
          //                           <Text style={styles.cstMetricValue}>
          //                             {profile.aiSummary?.emojiDesc ||
          //                               "Expressive contextual placement (~30%)"}
          //                           </Text>
          //                         </View>
          //
          //                         <View style={styles.cstMetricCard}>
          //                           <View
          //                             style={{
          //                               flexDirection: "row",
          //                               alignItems: "center",
          //                               gap: 6,
          //                             }}
          //                           >
          //                             <Ionicons
          //                               name="text-outline"
          //                               size={14}
          //                               color={uiTheme.colors.info}
          //                             />
          //                             <Text style={styles.cstMetricTitle}>
          //                               Punctuation & Flow
          //                             </Text>
          //                           </View>
          //                           <Text style={styles.cstMetricValue}>
          //                             {profile.aiSummary?.punctuationDesc ||
          //                               "Modern lowercase casual rhythm"}
          //                           </Text>
          //                         </View>
          //
          //                         <View style={styles.cstMetricCard}>
          //                           <View
          //                             style={{
          //                               flexDirection: "row",
          //                               alignItems: "center",
          //                               gap: 6,
          //                             }}
          //                           >
          //                             <Ionicons
          //                               name="flash-outline"
          //                               size={14}
          //                               color={uiTheme.colors.success}
          //                             />
          //                             <Text style={styles.cstMetricTitle}>
          //                               AI Mirroring Status
          //                             </Text>
          //                           </View>
          //                           <Text
          //                             style={[
          //                               styles.cstMetricValue,
          //                               {
          //                                 fontFamily: "Inter_700Bold",
          //                                 color: uiTheme.colors.success,
          //                                 fontWeight: "normal",
          //                               },
          //                             ]}
          //                           >
          //                             Active in Live Chats
          //                           </Text>
          //                         </View>
          //                       </View>
          //
          //                       {/* Action Buttons (100% Desktop V2 Complete Actions) */}
          //                       <View style={{ marginTop: 14, gap: 8 }}>
          //                         <TouchableOpacity
          //                           accessibilityRole="button"
          //                           style={styles.cstStartBtn}
          //                           onPress={() =>
          //                             startTrainingSession(viewingLang, !isPartial)
          //                           }
          //                           activeOpacity={0.85}
          //                         >
          //                           <Ionicons name="refresh" size={14} color="#FFF" />
          //                           <Text style={styles.cstStartBtnText}>
          //                             {isPartial
          //                               ? `Continue Training ${langObj.label}`
          //                               : `Retrain ${langObj.label} Style`}
          //                           </Text>
          //                         </TouchableOpacity>
          //
          //                         <TouchableOpacity
          //                           accessibilityRole="button"
          //                           style={styles.cstTrainAnotherBtn}
          //                           onPress={trainAnotherLanguage}
          //                           activeOpacity={0.8}
          //                         >
          //                           <Ionicons name="add" size={15} color="#FFF" />
          //                           <Text style={styles.cstTrainAnotherBtnText}>
          //                             + Train Another Language
          //                           </Text>
          //                         </TouchableOpacity>
          //
          //                         {hasSavedChat && (
          //                           <TouchableOpacity
          //                             accessibilityRole="button"
          //                             style={styles.cstSecondaryBtn}
          //                             onPress={() => setStyleView("replay")}
          //                             activeOpacity={0.8}
          //                           >
          //                             <Ionicons
          //                               name="chatbox-ellipses-outline"
          //                               size={14}
          //                               color={uiTheme.colors.text}
          //                             />
          //                             <Text style={styles.cstSecondaryBtnText}>
          //                               View training chat
          //                             </Text>
          //                           </TouchableOpacity>
          //                         )}
          //
          //                         <TouchableOpacity
          //                           accessibilityRole="button"
          //                           style={styles.cstSecondaryBtn}
          //                           onPress={() => setStyleView("intro")}
          //                           activeOpacity={0.8}
          //                         >
          //                           <Text style={styles.cstSecondaryBtnText}>
          //                             Back to Overview
          //                           </Text>
          //                         </TouchableOpacity>
          //
          //                         <TouchableOpacity
          //                           accessibilityRole="button"
          //                           style={styles.cstDeleteBtn}
          //                           onPress={() => deleteProfile(viewingLang)}
          //                           activeOpacity={0.8}
          //                         >
          //                           <Ionicons
          //                             name="trash-outline"
          //                             size={13}
          //                             color={uiTheme.colors.error}
          //                           />
          //                           <Text style={styles.cstDeleteBtnText}>
          //                             Delete {langObj.label} Profile
          //                           </Text>
          //                         </TouchableOpacity>
          //                       </View>
          //                     </View>
          //                   );
          //                 })()}
          //
          //               {/* ─── SCREEN 4: CHAT REPLAY (DESKTOP V2 _renderChatReplay PARITY) ─── */}
          //               {styleView === "replay" &&
          //                 (() => {
          //                   const profiles = form?.chatStyleProfiles || {};
          //                   const profile =
          //                     profiles[viewingLang] || form?.chatStyleProfile || {};
          //                   const langObj = LANGUAGE_OPTIONS.find(
          //                     (l) => l.code === viewingLang,
          //                   ) || { label: "English", flag: "🇺🇸" };
          //                   const replayMsgs =
          //                     profile.savedMessages && profile.savedMessages.length > 0
          //                       ? profile.savedMessages
          //                       : chatMessages;
          //
          //                   return (
          //                     <View style={styles.cstSimContainer}>
          //                       <View style={styles.cstSimTopBar}>
          //                         <TouchableOpacity
          //                           accessibilityRole="button"
          //                           style={{
          //                             flexDirection: "row",
          //                             alignItems: "center",
          //                             gap: 4,
          //                           }}
          //                           onPress={() => setStyleView("insights")}
          //                           activeOpacity={0.8}
          //                         >
          //                           <Ionicons
          //                             name="arrow-back"
          //                             size={16}
          //                             color="#C026D3"
          //                           />
          //                           <Text
          //                             style={{
          //                               fontFamily: "Inter_700Bold",
          //                               color: "#C026D3",
          //                               fontSize: 12,
          //                               fontWeight: "normal",
          //                             }}
          //                           >
          //                             Back
          //                           </Text>
          //                         </TouchableOpacity>
          //                         <Text style={styles.simMatchName}>
          //                           {langObj.flag} Training Transcript
          //                         </Text>
          //                         <View style={{ width: 40 }} />
          //                       </View>
          //
          //                       <ScrollView
          //                         style={[
          //                           styles.cstMessagesScroll,
          //                           { maxHeight: 300, minHeight: 200 },
          //                         ]}
          //                         contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
          //                         showsVerticalScrollIndicator={false}
          //                       >
          //                         {replayMsgs.map((msg) => (
          //                           <View
          //                             key={msg.id}
          //                             style={[
          //                               styles.simBubble,
          //                               msg.sender === "user"
          //                                 ? styles.simBubbleUser
          //                                 : styles.simBubbleMatch,
          //                             ]}
          //                           >
          //                             <Text
          //                               style={[
          //                                 styles.simBubbleText,
          //                                 msg.sender === "user" && { color: "#FFF" },
          //                               ]}
          //                             >
          //                               {msg.text}
          //                             </Text>
          //                           </View>
          //                         ))}
          //                       </ScrollView>
          //                     </View>
          //                   );
          //                 })()}
          //
          //               {/* ─── SCREEN 5: LOW QUALITY NOTIFICATION (DESKTOP V2 _renderLowQualityScreen PARITY) ─── */}
          //               {styleView === "lowQuality" &&
          //                 (() => {
          //                   const langObj = LANGUAGE_OPTIONS.find(
          //                     (l) => l.code === trainingLang,
          //                   ) || { label: "English", flag: "🇺🇸" };
          //                   return (
          //                     <View style={styles.cstInsightsContainer}>
          //                       <View style={styles.cstInsightsHeader}>
          //                         <View
          //                           style={[
          //                             styles.cstBadgeSuccess,
          //                             {
          //                               backgroundColor: "rgba(239, 68, 68, 0.15)",
          //                               borderColor: "rgba(239, 68, 68, 0.3)",
          //                             },
          //                           ]}
          //                         >
          //                           <Ionicons
          //                             name="warning-outline"
          //                             size={14}
          //                             color={uiTheme.colors.error}
          //                           />
          //                           <Text
          //                             style={[
          //                               styles.cstBadgeSuccessText,
          //                               { color: uiTheme.colors.error },
          //                             ]}
          //                           >
          //                             Replies Too Short
          //                           </Text>
          //                         </View>
          //                         <Text style={styles.cstInsightsTitle}>
          //                           Replies too short to learn from
          //                         </Text>
          //                         <Text style={styles.cstInsightsSub}>
          //                           The AI needs real sentences to pick up your style.
          //                           Single words or random characters don't give it enough
          //                           to work with. Try again and reply the way you'd
          //                           actually text someone.
          //                         </Text>
          //                       </View>
          //
          //                       <TouchableOpacity
          //                         accessibilityRole="button"
          //                         style={styles.cstStartBtn}
          //                         onPress={() => startTrainingSession(trainingLang, true)}
          //                         activeOpacity={0.85}
          //                       >
          //                         <Ionicons name="refresh" size={14} color="#FFF" />
          //                         <Text style={styles.cstStartBtnText}>
          //                           Try Again ({langObj.label})
          //                         </Text>
          //                       </TouchableOpacity>
          //
          //                       <TouchableOpacity
          //                         accessibilityRole="button"
          //                         style={[styles.cstSecondaryBtn, { marginTop: 8 }]}
          //                         onPress={() => setStyleView("intro")}
          //                         activeOpacity={0.8}
          //                       >
          //                         <Text style={styles.cstSecondaryBtnText}>
          //                           Back to Overview
          //                         </Text>
          //                       </TouchableOpacity>
          //                     </View>
          //                   );
          //                 })()}
          //             </View>
          //           )}
          //         </View>
        }

        {/* ════════════════════ CARD 5: AI ACTIVE TIME & SAFETY (DESKTOP V2 PARITY) ════════════════════ */}
        {
          // <View
          //           style={[styles.v2Card, openCards.activeTime && styles.v2CardOpen]}
          //         >
          //           <View style={styles.v2CardHeader}>
          //             <TouchableOpacity
          //               accessibilityRole="button"
          //               style={[styles.cardTitleWrap, { flex: 1 }]}
          //               onPress={() => toggleCard("activeTime")}
          //               activeOpacity={0.85}
          //             >
          //               <Ionicons
          //                 name="time-outline"
          //                 size={17}
          //                 color={uiTheme.colors.success}
          //               />
          //               <Text style={styles.v2CardTitle}>AI Active Time</Text>
          //             </TouchableOpacity>
          //
          //             <View
          //               style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          //             >
          //               {/* Range summary in header */}
          //               <Text style={styles.atHeaderRangeText}>
          //                 {form.activeHours?.enabled !== false
          //                   ? `${minsToDisplay(timeToMins(form.activeHours?.startTime || "09:00"))} – ${minsToDisplay(timeToMins(form.activeHours?.endTime || "22:00"))}`
          //                   : "24/7 (All Day)"}
          //               </Text>
          //
          //               {/* Master Active Hours Toggle matching Desktop V2 #atToggleInput */}
          //               <Switch
          //                 value={form.activeHours?.enabled !== false}
          //                 onValueChange={(val) => {
          //                   updateField("activeHours.enabled", val);
          //                   if (val && !openCards.activeTime) {
          //                     toggleCard("activeTime");
          //                   }
          //                 }}
          //                 trackColor={{
          //                   false: uiTheme.colors.elevated,
          //                   true: uiTheme.colors.success,
          //                 }}
          //                 thumbColor={
          //                   form.activeHours?.enabled !== false
          //                     ? "#FFF"
          //                     : uiTheme.colors.muted
          //                 }
          //               />
          //
          //               <TouchableOpacity
          //                 accessibilityRole="button"
          //                 onPress={() => toggleCard("activeTime")}
          //                 activeOpacity={0.85}
          //               >
          //                 <Ionicons
          //                   name={openCards.activeTime ? "chevron-up" : "chevron-down"}
          //                   size={18}
          //                   color={uiTheme.colors.muted}
          //                 />
          //               </TouchableOpacity>
          //             </View>
          //           </View>
          //
          //           {/* Collapsed Summary Chips */}
          //           {!openCards.activeTime && (
          //             <View style={styles.collapsedRow}>
          //               <View style={styles.v2Chip}>
          //                 <Ionicons
          //                   name="calendar"
          //                   size={11}
          //                   color={uiTheme.colors.success}
          //                 />
          //                 <Text style={styles.v2ChipText}>{getActiveTimeSummary()}</Text>
          //               </View>
          //             </View>
          //           )}
          //
          //           {/* Expanded Body */}
          //           {openCards.activeTime && (
          //             <View style={styles.v2CardBody}>
          //               <Text style={styles.fieldDesc}>
          //                 Set the active operating window during which your AI Wingman
          //                 operates on Tinder:
          //               </Text>
          //
          //               {/* 24-Hour Range Slider Track (Desktop V2 .at-track-row Parity) */}
          //               <View style={styles.subBox}>
          //                 <View style={styles.rowBetween}>
          //                   <Text style={styles.subBoxTitle}>Operating Hours Window</Text>
          //                   <Text
          //                     style={{
          //                       fontFamily: "Inter_700Bold",
          //                       color: uiTheme.colors.success,
          //                       fontSize: 11.5,
          //                       fontWeight: "normal",
          //                     }}
          //                   >
          //                     {form.activeHours?.enabled !== false
          //                       ? "Scheduled Active"
          //                       : "24/7 Always On"}
          //                   </Text>
          //                 </View>
          //
          //                 <TimeRangeSlider
          //                   startVal={form.activeHours?.startTime || "09:00"}
          //                   endVal={form.activeHours?.endTime || "22:00"}
          //                   disabled={form.activeHours?.enabled === false}
          //                   onValuesChange={(s, e) => {
          //                     updateField("activeHours.startTime", s);
          //                     updateField("activeHours.endTime", e);
          //                     updateField("activeHours.preset", "Custom");
          //                     if (form.activeHours?.enabled === false) {
          //                       updateField("activeHours.enabled", true);
          //                     }
          //                   }}
          //                 />
          //
          //                 {/* 24-Hour Schedule Timeline Visualizer Bar */}
          //                 <View style={styles.timelineWrap}>
          //                   <View style={styles.timelineBg}>
          //                     {form.activeHours?.enabled !== false &&
          //                       (() => {
          //                         const sMins = timeToMins(
          //                           form.activeHours?.startTime || "09:00",
          //                         );
          //                         const eMins = timeToMins(
          //                           form.activeHours?.endTime || "22:00",
          //                         );
          //                         const leftPct = (sMins / 1440) * 100;
          //                         const widthPct = Math.max(
          //                           ((eMins - sMins) / 1440) * 100,
          //                           2,
          //                         );
          //                         return (
          //                           <View
          //                             style={[
          //                               styles.timelineActiveFill,
          //                               { left: `${leftPct}%`, width: `${widthPct}%` },
          //                             ]}
          //                           />
          //                         );
          //                       })()}
          //                   </View>
          //                   <View style={styles.timelineMarkers}>
          //                     <Text style={styles.timelineMarkerText}>12 AM</Text>
          //                     <Text style={styles.timelineMarkerText}>6 AM</Text>
          //                     <Text style={styles.timelineMarkerText}>12 PM</Text>
          //                     <Text style={styles.timelineMarkerText}>6 PM</Text>
          //                     <Text style={styles.timelineMarkerText}>12 AM</Text>
          //                   </View>
          //                 </View>
          //
          //                 {/* Schedule Presets (24/7, Day, Evening, Custom) */}
          //                 <Text style={[styles.inputLabel, { marginTop: 14 }]}>
          //                   Quick Presets
          //                 </Text>
          //                 <View style={styles.chipRow}>
          //                   {ACTIVE_HOUR_PRESETS.map((p) => {
          //                     const isActive =
          //                       form.activeHours?.preset === p ||
          //                       (p === "24/7" && form.activeHours?.enabled === false) ||
          //                       (p === "Day (9am-10pm)" &&
          //                         form.activeHours?.enabled !== false &&
          //                         form.activeHours?.startTime === "09:00" &&
          //                         form.activeHours?.endTime === "22:00") ||
          //                       (p === "Evening (6pm-12am)" &&
          //                         form.activeHours?.enabled !== false &&
          //                         form.activeHours?.startTime === "18:00" &&
          //                         form.activeHours?.endTime === "23:59");
          //
          //                     return (
          //                       <TouchableOpacity
          //                         accessibilityRole="button"
          //                         key={p}
          //                         style={[styles.chip, isActive && styles.chipActive]}
          //                         onPress={() => {
          //                           if (p === "24/7") {
          //                             updateField("activeHours.enabled", false);
          //                             updateField("activeHours.preset", "24/7");
          //                             updateField("activeHours.startTime", "00:00");
          //                             updateField("activeHours.endTime", "23:59");
          //                           } else if (p === "Day (9am-10pm)") {
          //                             updateField("activeHours.enabled", true);
          //                             updateField("activeHours.preset", "Day (9am-10pm)");
          //                             updateField("activeHours.startTime", "09:00");
          //                             updateField("activeHours.endTime", "22:00");
          //                           } else if (p === "Evening (6pm-12am)") {
          //                             updateField("activeHours.enabled", true);
          //                             updateField(
          //                               "activeHours.preset",
          //                               "Evening (6pm-12am)",
          //                             );
          //                             updateField("activeHours.startTime", "18:00");
          //                             updateField("activeHours.endTime", "23:59");
          //                           } else {
          //                             updateField("activeHours.enabled", true);
          //                             updateField("activeHours.preset", "Custom");
          //                           }
          //                         }}
          //                         activeOpacity={0.8}
          //                       >
          //                         <Text
          //                           style={[
          //                             styles.chipText,
          //                             isActive && styles.chipTextActive,
          //                           ]}
          //                         >
          //                           {p}
          //                         </Text>
          //                       </TouchableOpacity>
          //                     );
          //                   })}
          //                 </View>
          //               </View>
          //             </View>
          //           )}
          //         </View>
        }
      </View>

      {/* ─── Generic V2 Info / Tooltip Modal (Desktop V2 Tooltip Parity) ─── */}
      <Modal
        visible={!!tooltipModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setTooltipModal(null)}
      >
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.simLangModalOverlay}
          activeOpacity={1}
          onPress={() => setTooltipModal(null)}
        >
          <View
            style={[styles.simLangModalContent, { maxWidth: 330, padding: 18 }]}
          >
            <View style={styles.simLangModalHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Ionicons
                  name="information-circle"
                  size={18}
                  color={uiTheme.colors.primary}
                />
                <Text style={styles.simLangModalTitle}>
                  {tooltipModal?.title || "How it works"}
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => setTooltipModal(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={18} color={uiTheme.colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 10, gap: 10 }}>
              {tooltipModal?.lines?.map((line, idx) => (
                <View
                  key={idx}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      color: uiTheme.colors.text,
                      fontSize: 12.5,
                      lineHeight: 18,
                      flex: 1,
                    }}
                  >
                    {line}
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              style={[
                styles.cstStartBtn,
                { marginTop: 16, paddingVertical: 10 },
              ]}
              onPress={() => setTooltipModal(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.cstStartBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: uiTheme.colors.background,
  },
  centerWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: uiTheme.spacing.xl,
    backgroundColor: uiTheme.colors.background,
  },
  loadingText: {
    fontFamily: "Inter_400Regular",
    color: uiTheme.colors.muted,
    marginTop: 10,
    fontSize: 13,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 0,
    paddingBottom: 24,
    gap: uiTheme.spacing.md,
  },

  // ─── V2 Accordion Cards ───
  v2Card: {
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.card,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    overflow: "hidden",
  },
  v2CardOpen: {
    borderColor: "rgba(254, 60, 114, 0.4)",
  },
  v2CardHeader: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: uiTheme.spacing.xl,
  },
  cardTitleWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  v2CardTitle: {
    fontFamily: "Manrope_800ExtraBold",
    flexShrink: 1,
    color: "#FFF",
    fontSize: uiTheme.type.body.fontSize,
    fontWeight: "normal",
    letterSpacing: -0.2,
  },

  // ─── Collapsed Summary Chips ───
  collapsedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: uiTheme.spacing.lg,
    paddingBottom: 14,
  },
  v2Chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: uiTheme.colors.elevated,
    paddingHorizontal: uiTheme.spacing.sm,
    paddingVertical: 4.5,
    borderRadius: 12,
    borderWidth: 0,
    borderColor: uiTheme.colors.elevated,
  },
  v2ChipText: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.textSecondary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },

  // ─── Expanded Card Body ───
  v2CardBody: {
    paddingHorizontal: uiTheme.spacing.lg,
    paddingBottom: uiTheme.spacing.lg,
    borderTopWidth: 1,
    borderColor: "#221E33",
    paddingTop: uiTheme.spacing.md,
  },
  fieldDesc: {
    fontFamily: "Inter_400Regular",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    marginBottom: uiTheme.spacing.md,
    lineHeight: 16,
  },

  // ─── Radio Group ───
  radioGroup: {
    gap: uiTheme.spacing.sm,
    marginBottom: uiTheme.spacing.md,
  },
  goalOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: uiTheme.colors.background,
    borderRadius: uiTheme.radius.input,
    padding: uiTheme.spacing.md,
    borderWidth: 1,
    borderColor: "#221E33",
  },
  goalOptionSelected: {
    borderColor: uiTheme.colors.primary,
    backgroundColor: "rgba(254, 60, 114, 0.06)",
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: uiTheme.colors.muted,
    justifyContent: "center",
    alignItems: "center",
  },
  radioCircleActive: {
    borderColor: uiTheme.colors.primary,
  },
  radioInnerCircle: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: uiTheme.colors.primary,
  },
  goalOptionLabel: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.text,
    fontSize: 13,
    fontWeight: "normal",
  },
  goalOptionSub: {
    fontFamily: "Inter_400Regular",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    marginTop: 1,
  },

  // ─── Sub-Boxes & Inputs ───
  subBox: {
    backgroundColor: uiTheme.colors.background,
    borderRadius: uiTheme.radius.input,
    padding: uiTheme.spacing.md,
    borderWidth: 1,
    borderColor: "#221E33",
    marginTop: 10,
  },
  subBoxTitle: {
    fontFamily: "Manrope_700Bold",
    color: "#FFF",
    fontSize: 12.5,
    fontWeight: "normal",
    marginBottom: uiTheme.spacing.sm,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    backgroundColor: uiTheme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
  },
  chipActive: {
    backgroundColor: uiTheme.colors.primary,
    borderColor: uiTheme.colors.primary,
  },
  chipText: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  chipTextActive: {
    fontFamily: "Inter_800ExtraBold",
    color: "#FFF",
    fontWeight: "normal",
  },
  inputGroup: {
    marginTop: uiTheme.spacing.sm,
  },
  inputLabel: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    marginBottom: uiTheme.spacing.xs,
  },
  textInput: {
    fontFamily: "Inter_400Regular",
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.small,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    color: "#FFF",
    fontSize: 12.5,
    paddingHorizontal: 10,
    paddingVertical: uiTheme.spacing.sm,
  },
  textArea: {
    fontFamily: "Inter_400Regular",
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.small,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    color: "#FFF",
    fontSize: 12.5,
    padding: 10,
    minHeight: 65,
    textAlignVertical: "top",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: uiTheme.spacing.sm,
  },
  labelMuted: {
    fontFamily: "Inter_400Regular",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
  },
  smallInput: {
    fontFamily: "Inter_400Regular",
    backgroundColor: uiTheme.colors.surface,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    color: "#FFF",
    fontSize: uiTheme.type.caption.fontSize,
    width: 54,
    textAlign: "center",
    paddingVertical: uiTheme.spacing.xs,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: uiTheme.spacing.sm,
  },
  v2ValueBadge: {
    backgroundColor: uiTheme.colors.elevated,
    paddingHorizontal: uiTheme.spacing.sm,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
  },
  v2ValueBadgeText: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.primary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  toggleTitle: {
    fontFamily: "Manrope_700Bold",
    color: "#FFF",
    fontSize: 13,
    fontWeight: "normal",
  },
  toggleSub: {
    fontFamily: "Inter_400Regular",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    marginTop: 1,
  },
  safetyChipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  safetyChipBadgeText: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.success,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  subBoxDivider: {
    height: 1,
    backgroundColor: "#221E33",
    marginVertical: 10,
  },
  speedButtonGroup: {
    flexDirection: "row",
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.small,
    padding: 3,
    gap: 3,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
  },
  speedBtn: {
    flex: 1,
    paddingVertical: uiTheme.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  speedBtnActive: {
    backgroundColor: uiTheme.colors.primary,
  },
  speedBtnText: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  speedBtnTextActive: {
    fontFamily: "Inter_800ExtraBold",
    color: "#FFF",
    fontWeight: "normal",
  },

  // ─── Chat Style Training (CST) V2 Parity Styles ───
  cstIntroContainer: {
    paddingVertical: 6,
  },
  cstIntroIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(192, 38, 211, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(192, 38, 211, 0.25)",
  },
  cstIntroTitle: {
    fontFamily: "Manrope_800ExtraBold",
    color: "#FFF",
    fontSize: uiTheme.type.body.fontSize,
    fontWeight: "normal",
    textAlign: "center",
    marginBottom: 6,
  },
  cstIntroDesc: {
    fontFamily: "Inter_400Regular",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    lineHeight: 17,
    textAlign: "center",
    marginBottom: 14,
    paddingHorizontal: uiTheme.spacing.sm,
  },
  cstTrainedBar: {
    backgroundColor: uiTheme.colors.background,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#221E33",
    marginBottom: uiTheme.spacing.sm,
  },
  cstTrainedBarLabel: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    marginBottom: 6,
  },
  cstTrainedChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  cstTrainedPill: {
    backgroundColor: uiTheme.colors.surface,
    borderRadius: 6,
    paddingHorizontal: uiTheme.spacing.sm,
    paddingVertical: uiTheme.spacing.xs,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
  },
  cstTrainedPillActive: {
    borderColor: "#C026D3",
    backgroundColor: "rgba(192, 38, 211, 0.15)",
  },
  cstTrainedPillText: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  cstTrainedPillTextActive: {
    fontFamily: "Inter_700Bold",
    color: "#C026D3",
    fontWeight: "normal",
  },
  cstStartBtn: {
    backgroundColor: "#C026D3",
    borderRadius: 10,
    paddingVertical: uiTheme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: uiTheme.spacing.sm,
    marginTop: 14,
  },
  cstStartBtnText: {
    fontFamily: "Inter_800ExtraBold",
    color: "#FFF",
    fontSize: 13,
    fontWeight: "normal",
  },
  cstViewTrainedBtn: {
    marginTop: uiTheme.spacing.sm,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: uiTheme.radius.small,
    borderWidth: 1,
    borderColor: "rgba(192, 38, 211, 0.3)",
    backgroundColor: "rgba(192, 38, 211, 0.06)",
  },
  cstViewTrainedBtnText: {
    fontFamily: "Inter_700Bold",
    color: "#C026D3",
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },

  // CST Simulator
  cstSimContainer: {
    backgroundColor: uiTheme.colors.background,
    borderRadius: uiTheme.radius.input,
    borderWidth: 1,
    borderColor: "#221E33",
    padding: uiTheme.spacing.md,
  },
  cstSimTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "#221E33",
    paddingBottom: 10,
  },
  cstSaveExitBtn: {
    backgroundColor: uiTheme.colors.surface,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    borderRadius: 6,
    paddingHorizontal: uiTheme.spacing.sm,
    paddingVertical: uiTheme.spacing.xs,
  },
  cstSaveExitBtnText: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.text,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  cstCancelBtn: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: uiTheme.colors.surface,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  cstProgressWrap: {
    paddingVertical: uiTheme.spacing.sm,
  },
  cstProgressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: uiTheme.spacing.xs,
  },
  cstProgressLabel: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  cstProgressValue: {
    fontFamily: "Inter_800ExtraBold",
    color: "#C026D3",
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  cstProgressBarBg: {
    height: 5,
    backgroundColor: uiTheme.colors.surface,
    borderRadius: 2.5,
    overflow: "hidden",
  },
  cstProgressBarFill: {
    height: "100%",
    backgroundColor: "#C026D3",
    borderRadius: 2.5,
  },
  cstMessagesScroll: {
    maxHeight: 230,
    minHeight: 140,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: uiTheme.colors.elevated,
    marginVertical: uiTheme.spacing.xs,
  },
  simAvatarWrapper: {
    position: "relative",
  },
  simAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: uiTheme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  simAvatarOnlineDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: uiTheme.colors.success,
    borderWidth: 1.5,
    borderColor: uiTheme.colors.background,
  },
  simMatchName: {
    fontFamily: "Inter_800ExtraBold",
    color: "#FFF",
    fontSize: 13,
    fontWeight: "normal",
  },
  simDateSeparator: {
    alignItems: "center",
    marginVertical: uiTheme.spacing.xs,
  },
  simDateSeparatorText: {
    fontFamily: "Inter_800ExtraBold",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    letterSpacing: 0.8,
  },
  simMatchRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    maxWidth: "88%",
    alignSelf: "flex-start",
  },
  simMatchAvatarTiny: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: uiTheme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  simBubble: {
    paddingHorizontal: uiTheme.spacing.md,
    paddingVertical: 9,
    borderRadius: 14,
    maxWidth: "85%",
  },
  simBubbleMatch: {
    backgroundColor: "#1F1B2E",
    borderWidth: 1,
    borderColor: "#2D2842",
    borderBottomLeftRadius: 3,
  },
  simBubbleUser: {
    backgroundColor: uiTheme.colors.primary,
    alignSelf: "flex-end",
    borderBottomRightRadius: 3,
  },
  simBubbleTextMatch: {
    fontFamily: "Inter_400Regular",
    color: "#FFF",
    fontSize: 12.5,
    lineHeight: 17,
  },
  simBubbleTextUser: {
    fontFamily: "Inter_400Regular",
    color: "#FFF",
    fontSize: 12.5,
    lineHeight: 17,
  },
  simActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: uiTheme.spacing.xs,
  },
  cstSaveInlinePill: {
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.input,
    paddingHorizontal: 10,
    paddingVertical: uiTheme.spacing.xs,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
  },
  cstSaveInlinePillText: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.primary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  cstProfilesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.xs,
    backgroundColor: "rgba(192, 38, 211, 0.1)",
    borderRadius: uiTheme.radius.input,
    paddingHorizontal: uiTheme.spacing.sm,
    paddingVertical: uiTheme.spacing.xs,
    borderWidth: 1,
    borderColor: "rgba(192, 38, 211, 0.25)",
    marginRight: 6,
  },
  cstProfilesBtnText: {
    fontFamily: "Inter_700Bold",
    color: "#C026D3",
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  simLangPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.xs,
    backgroundColor: "rgba(254, 60, 114, 0.1)",
    borderRadius: uiTheme.radius.input,
    paddingHorizontal: 10,
    paddingVertical: uiTheme.spacing.xs,
    borderWidth: 1,
    borderColor: "rgba(254, 60, 114, 0.25)",
  },
  simLangPillText: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.primary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  simInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.sm,
  },
  simTextInput: {
    fontFamily: "Inter_400Regular",
    flex: 1,
    backgroundColor: uiTheme.colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    color: "#FFF",
    fontSize: 12.5,
    paddingHorizontal: 14,
    paddingVertical: uiTheme.spacing.sm,
    height: 42,
  },
  simTextInputShaking: {
    borderColor: uiTheme.colors.warning,
    borderWidth: 1.5,
    backgroundColor: "rgba(245, 158, 11, 0.05)",
  },
  simInputWarningText: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.warning,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    marginTop: uiTheme.spacing.xs,
    marginLeft: 6,
  },
  simSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 21,
    backgroundColor: uiTheme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },

  // CST Insights (Completion Screen)
  cstInsightsContainer: {
    paddingVertical: uiTheme.spacing.xs,
  },
  cstInsightsHeader: {
    alignItems: "center",
    marginBottom: uiTheme.spacing.md,
  },
  cstBadgeSuccess: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.xs,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: uiTheme.spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    marginBottom: uiTheme.spacing.sm,
  },
  cstBadgeSuccessText: {
    fontFamily: "Inter_800ExtraBold",
    color: uiTheme.colors.success,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  cstInsightsTitle: {
    fontFamily: "Manrope_800ExtraBold",
    color: "#FFF",
    fontSize: 16,
    fontWeight: "normal",
    marginBottom: uiTheme.spacing.xs,
  },
  cstInsightsSub: {
    fontFamily: "Inter_400Regular",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 10,
  },
  cstMetricGrid: {
    gap: uiTheme.spacing.sm,
  },
  cstMetricCard: {
    backgroundColor: uiTheme.colors.background,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#221E33",
  },
  cstMetricTitle: {
    fontFamily: "Manrope_700Bold",
    color: uiTheme.colors.text,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  cstMetricValue: {
    fontFamily: "Inter_400Regular",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    marginTop: 3,
    marginLeft: uiTheme.spacing.xl,
  },
  cstRestartBtn: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: uiTheme.colors.surface,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  cstTraitsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    marginBottom: uiTheme.spacing.md,
  },
  cstTraitChip: {
    backgroundColor: uiTheme.colors.surface,
    paddingHorizontal: uiTheme.spacing.sm,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
  },
  cstTraitChipText: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.text,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  cstTrainAnotherBtn: {
    backgroundColor: "#9333EA",
    borderRadius: 10,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  cstTrainAnotherBtnText: {
    fontFamily: "Inter_800ExtraBold",
    color: "#FFF",
    fontSize: 12.5,
    fontWeight: "normal",
  },
  cstSecondaryBtn: {
    paddingVertical: 10,
    borderRadius: uiTheme.radius.small,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    backgroundColor: uiTheme.colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  cstSecondaryBtnText: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.text,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  simSystemHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderRadius: uiTheme.radius.small,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginVertical: uiTheme.spacing.xs,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    alignSelf: "center",
    maxWidth: "92%",
  },
  simSystemHintText: {
    fontFamily: "Inter_400Regular",
    color: uiTheme.colors.warning,
    fontSize: uiTheme.type.caption.fontSize,
    fontStyle: "italic",
    flex: 1,
    lineHeight: 15,
  },
  cstFinishBanner: {
    backgroundColor: uiTheme.colors.surface,
    borderWidth: 1,
    borderColor: "#9333EA",
    borderRadius: uiTheme.radius.input,
    padding: 14,
    alignItems: "center",
    marginVertical: uiTheme.spacing.sm,
  },
  cstFinishTitle: {
    fontFamily: "Manrope_800ExtraBold",
    color: "#FFF",
    fontSize: uiTheme.type.body.fontSize,
    fontWeight: "normal",
    marginBottom: uiTheme.spacing.xs,
  },
  cstFinishSub: {
    fontFamily: "Inter_400Regular",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    textAlign: "center",
    lineHeight: 16,
    marginBottom: 10,
  },
  cstFinishBtn: {
    backgroundColor: "#C026D3",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: uiTheme.radius.small,
  },
  cstFinishBtnText: {
    fontFamily: "Inter_800ExtraBold",
    color: "#FFF",
    fontSize: 12.5,
    fontWeight: "normal",
  },
  cstAiSummaryWrap: {
    backgroundColor: uiTheme.colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#221E33",
    padding: 10,
    marginBottom: 10,
  },
  cstAiSummaryLabel: {
    fontFamily: "Inter_800ExtraBold",
    color: uiTheme.colors.primary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    marginBottom: uiTheme.spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cstAiSummaryText: {
    fontFamily: "Inter_400Regular",
    color: uiTheme.colors.text,
    fontSize: uiTheme.type.caption.fontSize,
    lineHeight: 17,
  },
  cstDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: uiTheme.spacing.sm,
  },
  cstDeleteBtnText: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.error,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },

  // ─── Simulator Language Picker Modal ───
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: uiTheme.spacing.xl,
  },
  simLangModalContent: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#120F1D",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    padding: uiTheme.spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  simLangModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: uiTheme.spacing.md,
    borderBottomWidth: 1,
    borderColor: "#221E33",
    marginBottom: uiTheme.spacing.sm,
  },
  simLangModalTitle: {
    fontFamily: "Manrope_800ExtraBold",
    color: "#FFF",
    fontSize: uiTheme.type.label.fontSize,
    fontWeight: "normal",
  },
  simLangModalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: uiTheme.spacing.md,
    borderRadius: 10,
    marginVertical: 2,
  },
  simLangModalOptionSelected: {
    backgroundColor: "rgba(254, 60, 114, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(254, 60, 114, 0.3)",
  },
  simLangModalOptionText: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.text,
    fontSize: 13,
    fontWeight: "normal",
  },
  // ─── Contact Section & Move Off App (Desktop V2 Parity) ───
  contactSection: {
    backgroundColor: uiTheme.colors.background,
    borderRadius: uiTheme.radius.input,
    borderWidth: 1,
    borderColor: "#221E33",
    padding: uiTheme.spacing.md,
    marginTop: 10,
  },
  contactHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  contactHeaderTitle: {
    fontFamily: "Manrope_700Bold",
    color: "#FFF",
    fontSize: 13,
    fontWeight: "normal",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.sm,
    marginVertical: uiTheme.spacing.xs,
  },
  contactRowLabel: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.text,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    width: 68,
  },
  contactInput: {
    fontFamily: "Inter_400Regular",
    flex: 1,
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.small,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    color: "#FFF",
    fontSize: uiTheme.type.caption.fontSize,
    paddingHorizontal: uiTheme.spacing.sm,
    paddingVertical: 6,
    height: 36,
  },
  handleStatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.xs,
    marginLeft: 30,
    marginTop: -2,
    marginBottom: 6,
  },
  handleStatText: {
    fontFamily: "Inter_400Regular",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
  },
  genderSelector: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    backgroundColor: uiTheme.colors.surface,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
  },
  genderBtnActive: {
    backgroundColor: uiTheme.colors.primary,
    borderColor: uiTheme.colors.primary,
  },
  genderBtnText: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  genderBtnTextActive: {
    fontFamily: "Inter_800ExtraBold",
    color: "#FFF",
    fontWeight: "normal",
  },
  helperNote: {
    fontFamily: "Inter_400Regular",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    lineHeight: 15,
    marginTop: uiTheme.spacing.xs,
  },

  // ─── AI Active Time (Desktop V2 Parity) ───
  atHeaderRangeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    color: uiTheme.colors.muted,
  },
  timelineWrap: {
    marginTop: 10,
    marginBottom: uiTheme.spacing.xs,
  },
  timelineBg: {
    height: 8,
    backgroundColor: uiTheme.colors.elevated,
    borderRadius: 4,
    overflow: "hidden",
    position: "relative",
  },
  timelineActiveFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: uiTheme.colors.success,
    borderRadius: 4,
  },
  timelineMarkers: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: uiTheme.spacing.xs,
    paddingHorizontal: 2,
  },
  timelineMarkerText: {
    fontFamily: "Inter_600SemiBold",
    color: "#65637D",
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },

  // ─── Desktop V2 Toast Banner ───
  toastBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: uiTheme.spacing.sm,
    backgroundColor: "#064E3B",
    borderColor: uiTheme.colors.success,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: uiTheme.spacing.lg,
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: uiTheme.radius.input,
    zIndex: 99,
  },
  toastBannerText: {
    fontFamily: "Inter_700Bold",
    color: "#ECFDF5",
    fontSize: 13,
    fontWeight: "normal",
  },

  // ─── Desktop V2 Sticky Save Bar ───
  saveBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: uiTheme.colors.surface,
    borderTopWidth: 1,
    borderColor: uiTheme.colors.elevated,
    paddingHorizontal: 14,
    paddingVertical: uiTheme.spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 10,
  },
  saveBarProgress: {
    position: "absolute",
    top: 0,
    left: 0,
    height: 3,
    backgroundColor: uiTheme.colors.primary,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  saveBarContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  saveBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.sm,
    flex: 1,
    marginRight: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  unsavedDot: {
    backgroundColor: uiTheme.colors.warning,
  },
  savedDot: {
    backgroundColor: uiTheme.colors.success,
  },
  saveBarText: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  saveBarTextUnsaved: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.primary,
    fontWeight: "normal",
  },
  saveBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.sm,
  },
  discardBtn: {
    paddingVertical: uiTheme.spacing.sm,
    paddingHorizontal: 13,
    borderRadius: uiTheme.radius.small,
    borderWidth: 1,
    borderColor: uiTheme.colors.border,
    backgroundColor: "transparent",
  },
  discardBtnText: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.textSecondary,
    fontSize: 12.5,
    fontWeight: "normal",
  },
  saveChangesBtn: {
    backgroundColor: uiTheme.colors.primary,
    paddingVertical: uiTheme.spacing.sm,
    paddingHorizontal: uiTheme.spacing.lg,
    borderRadius: uiTheme.radius.small,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  saveChangesBtnIdle: {
    backgroundColor: "#E11D48",
    opacity: 0.95,
  },
  saveChangesBtnSuccess: {
    backgroundColor: uiTheme.colors.success,
    shadowColor: uiTheme.colors.success,
  },
  saveChangesBtnText: {
    fontFamily: "Inter_700Bold",
    color: "#FFF",
    fontSize: 12.5,
    fontWeight: "normal",
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    color: uiTheme.colors.error,
    fontSize: uiTheme.type.caption.fontSize,
    textAlign: "center",
    marginBottom: 6,
  },

  // ─── Swiping Location Capsule ───
  swipingLocationCapsule: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0E0C18",
    borderRadius: uiTheme.radius.input,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    paddingHorizontal: 14,
    paddingVertical: uiTheme.spacing.md,
    marginTop: 10,
  },
  swipingLocationLeft: {
    flex: 1,
    paddingRight: 10,
  },
  swipingLocationTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.sm,
    marginBottom: uiTheme.spacing.xs,
  },
  swipingLocationTitle: {
    fontFamily: "Manrope_700Bold",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  swipingLocationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  swipingLocationBadgeGps: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  swipingLocationBadgePassport: {
    backgroundColor: "rgba(254, 60, 114, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(254, 60, 114, 0.22)",
  },
  swipingLocationBadgeText: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    letterSpacing: 0.5,
  },
  swipingLocationCityRow: {
    marginTop: 2,
  },
  swipingLocationCityText: {
    fontFamily: "Inter_700Bold",
    color: "#FFF",
    fontSize: uiTheme.type.label.fontSize,
    fontWeight: "normal",
  },
  swipingLocationSub: {
    fontFamily: "Inter_400Regular",
    color: "#65637D",
    fontSize: uiTheme.type.caption.fontSize,
    marginTop: 2,
  },
  swipingLocationActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: uiTheme.radius.small,
    backgroundColor: "rgba(254, 60, 114, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(254, 60, 114, 0.25)",
  },
  swipingLocationActionText: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.primary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
});
