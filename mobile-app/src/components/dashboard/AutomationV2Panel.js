// src/components/dashboard/AutomationV2Panel.js — Comprehensive FlirtEasy V2 Panel with Style Training & Safety Controls
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  StyleSheet,
} from 'react-native';
import ActivityIndicator from '../common/SafeActivityIndicator';
import {
  LayoutAnimation,
  Platform,
  UIManager,
  Modal,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RangeSlider from '../common/RangeSlider';
import MultiRangeSlider from '../common/MultiRangeSlider';
import TimeRangeSlider, { timeToMins, minsToDisplay, minsTo24 } from '../common/TimeRangeSlider';
import V2Dropdown from '../common/V2Dropdown';
import { CITY_PRESETS } from '../../utils/locationHubs';
import { createStyles, theme as uiTheme, alpha } from '../../theme';
import useResponsive from '../../hooks/useResponsive';
import { FocusInput, FadeIn, ContentTransition, MotionTouchable, useMotionReduced } from '../common/Motion';
import { LinearGradient } from 'expo-linear-gradient';
import AppButton from '../ui/AppButton';
import AppText from '../ui/AppText';
import Badge from '../ui/Badge';
import Card from '../ui/Card';
import IconButton from '../ui/IconButton';
import IconWell from '../ui/IconWell';
import LiveDot from '../ui/LiveDot';
import SectionHeader from '../ui/SectionHeader';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Feature Flags ───
const SHOW_CHAT_STYLE_TRAINING = false;
const SHOW_AI_ACTIVE_TIME = false;
const SHOW_SWIPING_CONTROLS = true;
const SHOW_MESSAGING_CONTROLS = true;
const SHOW_LOCATION_FEATURE = false;
const SHOW_DEFAULT_LANGUAGE = false;
// Previous accordion layout of the "Your Dating Goal" card, kept for reference.
// The redesigned sections below render the exact same controls (goal, stop-after-goal, handles, gender).
const SHOW_LEGACY_GOAL_ACCORDION = false;

// ─── Goal Options ───
const GOAL_OPTIONS = [
  { id: 'date', label: 'Set up a Date', desc: 'Propose coffee, drinks, dinner or activity', icon: 'calendar-outline' },
  { id: 'phone', label: 'Get Phone Number / WhatsApp', desc: 'Move conversation to WhatsApp or SMS', icon: 'logo-whatsapp' },
  { id: 'instagram', label: 'Get Social Media', desc: 'Exchange Instagram handles and socials', icon: 'logo-instagram' },
  { id: 'never', label: 'Keep Engaging', desc: 'Continuous natural AI conversation on-app', icon: 'infinite-outline' },
];

const INTENTIONS_OPTIONS = [
  { id: 'short_term', label: 'Short term dating' },
  { id: 'long_term', label: 'Long term relationship' },
  { id: 'just_fun', label: 'Just for fun' },
  { id: 'casual_connection', label: 'Casual connection' },
  { id: 'meaningful_conversations', label: 'Meaningful conversations' },
  { id: 'open_to_anything', label: 'Open to anything' },
  { id: 'lets_see', label: "Let's see where it goes" },
];

const TONE_OPTIONS = [
  'Freestyle',
  'Serious',
  'Gentle',
  'Flirty',
  'Playful',
  'Confident',
  'Witty',
  'Charming',
  'Bold',
  'Romantic',
];

const LANGUAGE_OPTIONS = [
  { code: 'ar', label: 'Arabic', flag: '🇸🇦' },
  { code: 'bn', label: 'Bengali', flag: '🇧🇩' },
  { code: 'zh', label: 'Chinese', flag: '🇨🇳' },
  { code: 'cs', label: 'Czech', flag: '🇨🇿' },
  { code: 'da', label: 'Danish', flag: '🇩🇰' },
  { code: 'nl', label: 'Dutch', flag: '🇳🇱' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'fi', label: 'Finnish', flag: '🇫🇮' },
  { code: 'fr', label: 'French', flag: '🇫🇷' },
  { code: 'de', label: 'German', flag: '🇩🇪' },
  { code: 'el', label: 'Greek', flag: '🇬🇷' },
  { code: 'he', label: 'Hebrew', flag: '🇮🇱' },
  { code: 'hi', label: 'Hindi', flag: '🇮🇳' },
  { code: 'hu', label: 'Hungarian', flag: '🇭🇺' },
  { code: 'id', label: 'Indonesian', flag: '🇮🇩' },
  { code: 'it', label: 'Italian', flag: '🇮🇹' },
  { code: 'ja', label: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', label: 'Korean', flag: '🇰🇷' },
  { code: 'no', label: 'Norwegian', flag: '🇳🇴' },
  { code: 'fa', label: 'Persian', flag: '🇮🇷' },
  { code: 'pl', label: 'Polish', flag: '🇵🇱' },
  { code: 'pt', label: 'Portuguese', flag: '🇧🇷' },
  { code: 'ro', label: 'Romanian', flag: '🇷🇴' },
  { code: 'ru', label: 'Russian', flag: '🇷🇺' },
  { code: 'es', label: 'Spanish', flag: '🇪🇸' },
  { code: 'sw', label: 'Swahili', flag: '🇰🇪' },
  { code: 'sv', label: 'Swedish', flag: '🇸🇪' },
  { code: 'th', label: 'Thai', flag: '🇹🇭' },
  { code: 'tr', label: 'Turkish', flag: '🇹🇷' },
  { code: 'uk', label: 'Ukrainian', flag: '🇺🇦' },
  { code: 'ur', label: 'Urdu', flag: '🇵🇰' },
  { code: 'vi', label: 'Vietnamese', flag: '🇻🇳' },
];

const PRIORITY_PRESETS = [
  { value: 30, ratio: '70 : 30', desc: 'Mostly replies to current chats' },
  { value: 50, ratio: '50 : 50', desc: 'Balanced outreach & replies (Recommended)' },
  { value: 70, ratio: '30 : 70', desc: 'Aggressively messages new matches' },
];

const DATE_GOALS = ['coffee', 'drinks', 'dinner', 'activity'];
const GENDER_OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
];
const ACTIVE_HOUR_PRESETS = ['24/7', 'Day (9am-10pm)', 'Evening (6pm-12am)', 'Custom'];
const REPLY_LENGTHS = [
  { id: 'short', label: 'Short & Punchy' },
  { id: 'medium', label: 'Balanced' },
  { id: 'long', label: 'Detailed' },
];
const EMOJI_STYLES = [
  { id: 'none', label: 'None' },
  { id: 'subtle', label: 'Subtle (1-2)' },
  { id: 'expressive', label: 'Expressive' },
];

// ─── Multi-Language Localized Practice Match Personas (Desktop V2 Parity) ───
const LOCALIZED_TRAINING_PERSONAS = {
  en: {
    name: 'Mia',
    opener: "hey! your profile actually made me stop scrolling 👀 what do you do for fun?",
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
    ]
  },
  es: {
    name: 'Sofía',
    opener: "¡hola! tu perfil me llamó mucho la atención 👀 ¿qué te gusta hacer en tu tiempo libre?",
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
    ]
  },
  fr: {
    name: 'Camille',
    opener: "salut ! ton profil m'a direct tapé dans l'œil 👀 qu'est-ce que tu aimes faire pour t'amuser ?",
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
    ]
  },
  de: {
    name: 'Lena',
    opener: "hey! dein profil hat mich sofort neugierig gemacht 👀 was machst du am liebsten in deiner freizeit?",
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
    ]
  },
  it: {
    name: 'Giulia',
    opener: "ciao! il tuo profilo mi ha davvero colpito 👀 cosa ti piace fare nel tempo libero?",
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
    ]
  },
  pt: {
    name: 'Beatriz',
    opener: "oi! o teu perfil chamou mesmo a minha atenção 👀 o que gostas de fazer nos tempos livres?",
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
    ]
  },
  ru: {
    name: 'Анна',
    opener: "привет! твой профиль сразу привлек внимание 👀 чем любишь заниматься в свободное время?",
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
    ]
  },
  hi: {
    name: 'Priya',
    opener: "hey! aapki profile dekh kar scrolling stop karni padi 👀 free time mein kya karna pasand hai?",
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
    ]
  },
  zh: {
    name: '雨萱',
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
    ]
  },
  ja: {
    name: 'ユイ',
    opener: "こんにちは！プロフィールが気になって声かけちゃいました👀 休みの日は何して過ごすことが多いですか？",
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
    ]
  },
  ko: {
    name: '지우',
    opener: "안녕하세요! 프로필 보고 눈에 띄어서 말 걸어봐요 👀 평소 쉴 때는 보통 뭐하세요?",
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
    ]
  },
  ar: {
    name: 'نور',
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
    ]
  },
  nl: {
    name: 'Sophie',
    opener: "hey! je profiel viel me meteen op 👀 wat doe je het liefst in je vrije tijd?",
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
    ]
  },
  tr: {
    name: 'Elif',
    opener: "selam! profilin gerçekten dikkatimi çekti 👀 boş zamanlarında neler yapmaktan hoşlanırsın?",
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
    ]
  },
  pl: {
    name: 'Maja',
    opener: "hej! twój profil od razu przyciągnął moją uwagę 👀 co lubisz robić w wolnym czasie?",
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
    ]
  },
  sv: {
    name: 'Emma',
    opener: "hej! din profil fångade verkligen mitt intresse 👀 vad gillar du att göra på fritiden?",
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
    ]
  },
  da: {
    name: 'Freja',
    opener: "hej! din profil fangede virkelig min opmærksomhed 👀 hvad kan du bedst lide at lave i din fritid?",
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
    ]
  },
  fi: {
    name: 'Aino',
    opener: "hei! profiilisi kiinnitti heti huomioni 👀 mitä tykkäät puuhailla vapaa-ajallasi?",
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
    ]
  },
  no: {
    name: 'Ingrid',
    opener: "hei! profilen din fanget virkelig oppmerksomheten min 👀 hva liker du å gjøre på fritiden?",
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
    ]
  },
  cs: {
    name: 'Eliška',
    opener: "ahoj! tvůj profil mě opravdu zaujal 👀 co rád(a) děláš ve volném čase?",
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
    ]
  },
  el: {
    name: 'Elena',
    opener: "γεια σου! το προφίλ σου μου τράβηξε αμέσως την προσοχή 👀 τι σου αρέσει να κάνεις στον ελεύθερο χρόνο σου;",
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
    ]
  },
  he: {
    name: 'Maya',
    opener: "היי! הפרופיל שלך ממש משך לי את העין 👀 מה אתה אוהב לעשות בזמן הפנוי?",
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
    ]
  },
  hu: {
    name: 'Lili',
    opener: "szia! a profilod azonnal felkeltette a figyelmem 👀 mit csinálsz a legszívesebben a szabadidődben?",
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
    ]
  },
  id: {
    name: 'Siti',
    opener: "halo! profilmu langsung bikin penasaran 👀 biasanya suka ngapain aja nih pas waktu luang?",
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
    ]
  },
  ro: {
    name: 'Ioana',
    opener: "bună! profilul tău mi-a atras imediat atenția 👀 ce îți place să faci în timpul liber?",
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
    ]
  },
  th: {
    name: 'Ploi',
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
    ]
  },
  uk: {
    name: 'Олена',
    opener: "привіт! твій профіль одразу привернув увагу 👀 чим любиш займатися у вільний час?",
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
    ]
  },
  vi: {
    name: 'Linh',
    opener: "chào bạn! trang cá nhân của bạn làm mình chú ý liền luôn 👀 lúc rảnh bạn hay làm gì nè?",
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
    ]
  },
  bn: {
    name: 'Ananya',
    opener: "hey! tomar profile dekhe besh bhalo laglo 👀 oboshor shomoye ki korte bhalobasho?",
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
    ]
  },
  fa: {
    name: 'Darya',
    opener: "salam! profilet kheili jaleb bood 👀 vaghtaye bikari chikar mikoni?",
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
    ]
  },
  sw: {
    name: 'Zuri',
    opener: "habari! profile yako imenivutia sana 👀 unapenda kufanya nini wakati wa mapumziko?",
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
    ]
  },
  ur: {
    name: 'Ayesha',
    opener: "hey! aap ki profile dekh kar rukna para 👀 free time mein kya karna pasand hai?",
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
    ]
  },
};

const getPersonaForLang = (langCode) => {
  const code = (langCode || 'en').toLowerCase();
  return LOCALIZED_TRAINING_PERSONAS[code] || LOCALIZED_TRAINING_PERSONAS.en;
};

// ─── Redesigned Automation page building blocks (UI only; values/callbacks come from the panel) ───
const SEGMENT_PAD = 3;
const SEGMENT_BORDER = 1;

// Large selectable goal card: icon well, title, one-line description and a radio check.
function GoalOptionCard({ option, selected, onPress }) {
  return (
    <MotionTouchable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={`${option.label}. ${option.desc}`}
      accessibilityState={{ checked: selected, selected }}
      pressScale={0.98}
      activeOpacity={0.9}
      style={[styles.goalCard, selected && styles.goalCardSelected]}
    >
      <IconWell icon={option.icon} tone={selected ? 'primary' : 'neutral'} size={44} />
      <View style={styles.goalCardCopy}>
        <AppText variant="headline" numberOfLines={2}>{option.label}</AppText>
        <AppText variant="footnote" color={selected ? 'textSecondary' : 'muted'} numberOfLines={2} style={styles.goalCardDesc}>{option.desc}</AppText>
      </View>
      <View style={[styles.goalRadio, selected && styles.goalRadioSelected]}>
        {selected ? <Ionicons name="checkmark" size={14} color={uiTheme.colors.onPrimary} /> : null}
      </View>
    </MotionTouchable>
  );
}

// Segmented control with a sliding brand-gradient thumb (native-driver translateX).
function SegmentedControl({ options, value, onChange, accessibilityLabel }) {
  const reduced = useMotionReduced();
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(0, options.findIndex(o => o.id === value));
  const position = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    position.stopAnimation();
    if (reduced) { position.setValue(index); return undefined; }
    const animation = Animated.spring(position, { toValue: index, damping: 20, stiffness: 260, mass: 0.9, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [index, reduced, position]);

  const segmentWidth = trackWidth ? (trackWidth - (SEGMENT_PAD + SEGMENT_BORDER) * 2) / options.length : 0;

  return (
    <View
      style={styles.segmented}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.segmentThumb, { width: segmentWidth, transform: [{ translateX: Animated.multiply(position, segmentWidth) }] }]}
        >
          <LinearGradient colors={uiTheme.gradients.brandShort} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
      {options.map(option => {
        const selected = option.id === value;
        return (
          <MotionTouchable
            key={option.id}
            onPress={() => onChange(option.id)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected, selected }}
            pressScale={0.96}
            activeOpacity={0.85}
            style={styles.segment}
          >
            <AppText
              variant="buttonSmall"
              color={selected ? 'onPrimary' : 'muted'}
              numberOfLines={1}
              maxFontSizeMultiplier={uiTheme.fontScale.chrome}
              style={styles.segmentText}
            >
              {option.label}
            </AppText>
          </MotionTouchable>
        );
      })}
    </View>
  );
}

// Contact handle row: icon + label + switch; the input slides in below when the handle is shared.
function ContactHandleRow({ icon, tone, title, switchLabel, enabled, onToggle, sentCount, value, inputLabel, missingHint, divider, inputProps, style }) {
  const missing = enabled && !String(value || '').trim();
  return (
    <View style={[styles.handleRow, divider && styles.handleRowDivider, style]}>
      <View style={styles.handleRowHead}>
        <IconWell icon={icon} tone={enabled ? tone : 'neutral'} size={40} />
        <View style={styles.handleRowCopy}>
          <AppText variant="bodyStrong" numberOfLines={1}>{title}</AppText>
          <View style={styles.handleSentRow}>
            <Ionicons name="paper-plane-outline" size={12} color={uiTheme.colors.muted} />
            <AppText variant="footnote" numberOfLines={1} style={styles.handleSentText}>
              Sent to <AppText variant="footnote" color={enabled ? 'text' : 'muted'} style={styles.handleStatCount}>{sentCount}</AppText> matches
            </AppText>
          </View>
        </View>
        <Switch
          accessibilityLabel={switchLabel}
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ false: uiTheme.colors.elevatedHigh, true: uiTheme.colors.primary }}
          thumbColor={uiTheme.colors.white}
          ios_backgroundColor={uiTheme.colors.elevatedHigh}
        />
      </View>
      {enabled ? (
        <FadeIn offset={-6} style={styles.handleInputWrap}>
          <AppText variant="caption" color="textSecondary" style={styles.handleInputLabel}>{inputLabel}</AppText>
          <FocusInput
            {...inputProps}
            value={value || ''}
            autoCorrect={false}
            style={[styles.handleInput, missing && styles.handleInputMissing]}
          />
          {missing ? (
            <View style={styles.handleHintRow}>
              <Ionicons name="alert-circle-outline" size={13} color={uiTheme.colors.warning} />
              <AppText variant="caption" color="warning" style={styles.handleHintText}>{missingHint}</AppText>
            </View>
          ) : null}
        </FadeIn>
      ) : null}
    </View>
  );
}

export default function AutomationV2Panel({ settings, loading, saving, saveSuccess, error, onSave, onDirtyChange, onNavigateToSettings }) {
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
  const [styleView, setStyleView] = useState('intro'); // 'intro' | 'chat' | 'insights'
  const [trainingLang, setTrainingLang] = useState('en');
  const [viewingLang, setViewingLang] = useState('en');
  const [chatMessages, setChatMessages] = useState([]);
  const [inputPracticeMsg, setInputPracticeMsg] = useState('');
  const [calibrating, setCalibrating] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [inputWarning, setInputWarning] = useState('');
  const [inputShaking, setInputShaking] = useState(false);
  const [inlineSaved, setInlineSaved] = useState(false);
  const [simLangModalOpen, setSimLangModalOpen] = useState(false);
  const [tooltipModal, setTooltipModal] = useState(null);
  const reduceMotion = useMotionReduced();

  // ─── Responsive layout (phones stay single column; tablets get 2–3 across) ───
  const { contentMax, columns, isTablet, isXL } = useResponsive();
  // Wide option cards (icon + title + description + radio) need ~240pt each.
  const optionCols = isTablet ? Math.min(columns, isXL ? 3 : 2) : 1;
  const optionItemStyle = optionCols > 1
    ? { flexGrow: 1, flexBasis: optionCols >= 3 ? '30%' : '46%', minWidth: 240 }
    : null;
  const handleCols = isTablet ? Math.min(columns, 2) : 1;

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

      // Resolve goal, stopConditions, and selectedGoals from settings
      let initialGoals = [];
      if (Array.isArray(cloned.selectedGoals) && cloned.selectedGoals.length > 0) {
        initialGoals = cloned.selectedGoals;
      } else if (Array.isArray(cloned.stopConditions) && cloned.stopConditions.length > 0) {
        initialGoals = cloned.stopConditions;
      } else if (cloned.goal) {
        initialGoals = [cloned.goal];
      } else {
        initialGoals = ['never'];
      }
      initialGoals = initialGoals.map(g => g === 'never_stop' ? 'never' : g);
      if (initialGoals.includes('never') || initialGoals.length === 0) {
        initialGoals = ['never'];
      }
      cloned.selectedGoals = initialGoals;
      cloned.goal = initialGoals[0] || 'never';
      cloned.stopConditions = initialGoals.includes('never') ? [] : initialGoals;
      if (cloned.stopAfterGoal === undefined && cloned.stopAfterGoalEnabled !== undefined) {
        cloned.stopAfterGoal = cloned.stopAfterGoalEnabled;
      }
      if (cloned.goal === 'never') {
        cloned.stopAfterGoal = false;
        cloned.stopAfterGoalEnabled = false;
      }
      if (cloned.locationLatitude === undefined) cloned.locationLatitude = 40.7128;
      if (cloned.locationLongitude === undefined) cloned.locationLongitude = -74.0060;
      if (!cloned.locationCity) cloned.locationCity = 'New York, USA';

      // Enforce invariant: At least one of autoSwipe or autoMessage must be active
      const isSwipeOn = cloned.autoSwipe !== false && (cloned.likesPerCycle ?? 50) > 0;
      const isMsgOn = cloned.autoMessage !== false && (cloned.messagesPerCycle ?? 50) > 0;
      if (!isSwipeOn && !isMsgOn) {
        cloned.autoSwipe = true;
        cloned.likesPerCycle = cloned.lastNonZeroLikes || 50;
      }

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
      setToastMessage('Settings saved successfully!');
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 2500);
      return () => clearTimeout(timer);
    } else {
      setToastMessage(null);
    }
  }, [saveSuccess, hideSaveBar, onDirtyChange]);

  useEffect(() => {
    return () => {
      if (formRef.current && hasUnsavedChanges) {
        handleSavePress(formRef.current);
      }
    };
  }, [hasUnsavedChanges, handleSavePress]);

  const toggleCard = (cardKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenCards(prev => ({
      ...prev,
      [cardKey]: !prev[cardKey],
    }));
  };

  const toggleContactDetails = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setContactDetailsOpen(prev => !prev);
  };

  const handleDiscard = useCallback(() => {
    if (settings) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const cloned = JSON.parse(JSON.stringify(settings));
      let initialGoals = [];
      if (Array.isArray(cloned.selectedGoals) && cloned.selectedGoals.length > 0) {
        initialGoals = cloned.selectedGoals;
      } else if (Array.isArray(cloned.stopConditions) && cloned.stopConditions.length > 0) {
        initialGoals = cloned.stopConditions;
      } else if (cloned.goal) {
        initialGoals = [cloned.goal];
      } else {
        initialGoals = ['never'];
      }
      initialGoals = initialGoals.map(g => g === 'never_stop' ? 'never' : g);
      if (initialGoals.includes('never') || initialGoals.length === 0) {
        initialGoals = ['never'];
      }
      cloned.selectedGoals = initialGoals;
      cloned.goal = initialGoals[0] || 'never';
      cloned.stopConditions = initialGoals.includes('never') ? [] : initialGoals;
      if (cloned.stopAfterGoal === undefined && cloned.stopAfterGoalEnabled !== undefined) {
        cloned.stopAfterGoal = cloned.stopAfterGoalEnabled;
      }
      if (cloned.goal === 'never') {
        cloned.stopAfterGoal = false;
        cloned.stopAfterGoalEnabled = false;
      }
      setForm(cloned);
      formRef.current = cloned;
      setHasUnsavedChanges(false);
      hideSaveBar();
      if (onDirtyChange) onDirtyChange(false, null, null);
      setToastMessage('Changes discarded');
      setTimeout(() => setToastMessage(null), 2500);
    }
  }, [settings, hideSaveBar, onDirtyChange]);

  const handleSavePress = useCallback((overrideForm) => {
    const targetForm = overrideForm || formRef.current || form;
    if (onSave && targetForm) {
      const payload = { ...targetForm };

      // Ensure goal, stopConditions, and stopAfterGoal are in 100% parity with Desktop V2
      let activeGoals = Array.isArray(payload.selectedGoals) && payload.selectedGoals.length > 0
        ? payload.selectedGoals
        : [payload.goal || 'never'];
      activeGoals = activeGoals.map(g => g === 'never_stop' ? 'never' : g);
      if (activeGoals.includes('never') || activeGoals.length === 0) {
        activeGoals = ['never'];
      }
      payload.selectedGoals = activeGoals;
      payload.goal = activeGoals[0] || 'never';
      payload.stopConditions = activeGoals.includes('never') ? [] : activeGoals;
      payload.stopAfterGoalEnabled = payload.stopAfterGoal !== false && !activeGoals.includes('never');
      payload.stopAfterGoal = payload.stopAfterGoalEnabled;

      // Ensure tone and chattingStyle are both set
      const toneVal = payload.tone || payload.chattingStyle || 'Freestyle';
      payload.tone = toneVal.charAt(0).toUpperCase() + toneVal.slice(1);
      payload.chattingStyle = toneVal.toLowerCase();

      // Ensure priority percentages are synced
      const prioVal = payload.prioritySlider ?? payload.minReplySlots ?? 50;
      payload.minReplyPercent = prioVal === 30 ? 70 : (prioVal === 70 ? 30 : 50);
      payload.maxNewMatchPercent = prioVal === 30 ? 30 : (prioVal === 70 ? 70 : 50);
      payload.minReplySlots = payload.minReplyPercent;
      payload.maxNewMatchSlots = payload.maxNewMatchPercent;

      // Ensure toggles are boolean values
      payload.useEmojis = payload.useEmojis !== false;
      payload.randomHearts = (payload.randomHearts === true || payload.smartReactionsEnabled === true);
      payload.smartReactionsEnabled = payload.randomHearts;
      payload.consecutiveMessagesEnabled = payload.consecutiveMessagesEnabled === true;

      // Ensure filters are structured for both V1 and V2
      if (payload.ageFilter) {
        payload.ageFilter.minAge = payload.ageFilter.min ?? payload.ageFilter.minAge ?? 18;
        payload.ageFilter.maxAge = payload.ageFilter.max ?? payload.ageFilter.maxAge ?? 99;
        payload.ageFilter.min = payload.ageFilter.minAge;
        payload.ageFilter.max = payload.ageFilter.maxAge;
      }

      // Ensure Active Hours top-level & object properties are synced
      if (payload.activeHours) {
        payload.activeHoursEnabled = payload.activeHours.enabled === true;
        payload.startTime = payload.activeHours.startTime;
        payload.endTime = payload.activeHours.endTime;
      }

      // Ensure at least one of Auto-Swipe or Auto-Messaging is active in saved payload
      const isSwipeOn = payload.autoSwipe !== false && (payload.likesPerCycle ?? 50) > 0;
      const isMsgOn = payload.autoMessage !== false && (payload.messagesPerCycle ?? 50) > 0;
      if (!isSwipeOn && !isMsgOn) {
        payload.autoSwipe = true;
        payload.likesPerCycle = payload.lastNonZeroLikes || 50;
      }

      onSave(payload);
    }
  }, [onSave, form]);

  const updateField = (path, value) => {
    let nextState = null;
    setForm(prev => {
      const next = { ...prev };
      const keys = path.split('.');
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
  };

  const updateFields = (updates) => {
    let nextState = null;
    setForm(prev => {
      const next = { ...prev };
      Object.entries(updates).forEach(([path, value]) => {
        const keys = path.split('.');
        let current = next;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) current[keys[i]] = {};
          current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
      });
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
    const t = (text || '').trim();
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
        const rev = t.split('').reverse().join('');
        if (rev === t && vowels / letters < 0.4) return true; // palindrome with low vowels
        if (rev.startsWith(t.slice(0, Math.floor(t.length / 2))) && vowels / letters < 0.3) return true;
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
      const uniqueWords = new Set(words.map(w => w.toLowerCase()));
      if (uniqueWords.size === 1) return true;
      if (uniqueWords.size / words.length < 0.35) return true;
    }

    return false;
  };

  const analyzeUserStyle = (messages) => {
    const userMsgs = messages.filter(m => (m.sender === 'user' || m.role === 'user') && !m.garbage).map(m => m.text);
    const allUserMsgs = messages.filter(m => m.sender === 'user' || m.role === 'user').map(m => m.text);
    const source = userMsgs.length >= 3 ? userMsgs : allUserMsgs;
    if (!source.length) return null;

    const avgLen = source.reduce((s, m) => s + m.length, 0) / source.length;
    const totalWords = source.reduce((acc, text) => acc + text.trim().split(/\s+/).length, 0);
    const avgWords = Math.max(1, Math.round(totalWords / source.length));

    let totalEmojis = 0;
    try {
      const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
      totalEmojis = source.reduce((s, m) => s + (m.match(emojiRegex) || []).length, 0);
    } catch (_) {
      totalEmojis = source.reduce((s, m) => s + (m.match(/[\u{1F300}-\u{1FAFF}]/gu) || []).length, 0);
    }

    const emojiRate = totalEmojis / source.length;
    const emojiPct = Math.min(Math.round((totalEmojis / source.length) * 100), 100);
    const questionCount = source.filter(m => m.includes('?')).length;
    const lowerCount = source.filter(m => m.length > 3 && m[0] === m[0].toLowerCase()).length;
    const lowerRatio = lowerCount / source.length;
    const hahaCount = source.filter(m => /\b(haha|lol|lmao|hehe|omg|ngl|fr|imo|tbh|lowkey)\b/i.test(m)).length;
    const noPeriodCount = source.filter(m => m.trim().length > 3 && !m.trim().endsWith('.')).length;

    const length = avgLen < 40 ? 'short' : avgLen < 100 ? 'medium' : 'long';
    const emoji = emojiRate === 0 ? 'none'
                 : emojiRate < 0.5 ? 'light'
                 : emojiRate < 1.5 ? 'moderate' : 'heavy';

    let tone = 'casual';
    if (lowerRatio > 0.65 && hahaCount >= 2) tone = 'playful-casual';
    else if (lowerRatio <= 0.4) tone = 'formal';

    const asksQuestions = questionCount >= Math.floor(source.length * 0.35);
    const skipsPunctuation = noPeriodCount / source.length > 0.6;

    const slangTokens = ['tbh', 'ngl', 'fr', 'lowkey', 'highkey', 'lol', 'lmao', 'haha', 'omg', 'imo', 'rn', 'idk', 'idc', 'nvm', 'smh', 'ik', 'ikr'];
    const slangUsed = slangTokens.filter(s => source.some(m => new RegExp(`\\b${s}\\b`, 'i').test(m)));

    // Pick 3 diverse examples — short, medium, long — capped at 200 chars
    const byLen = [...source].sort((a, b) => a.length - b.length);
    const candidates = [
      byLen[0],
      byLen[Math.floor(byLen.length / 2)],
      byLen[byLen.length - 1],
    ].filter((v, i, a) => v && a.indexOf(v) === i);

    const examples = candidates
      .map(e => e.length > 200 ? e.slice(0, 200) : e)
      .slice(0, 3);

    const tempoDesc = avgWords <= 6
      ? `Punchy & Direct (avg ${avgWords} words)`
      : (avgWords >= 14 ? `Detailed & Expressive (avg ${avgWords} words)` : `Balanced & Natural (avg ${avgWords} words)`);

    const emojiDesc = emoji === 'none'
      ? 'No emoji'
      : (emoji === 'heavy' ? `Expressive emoji (~${emojiPct}%)` : `Light emoji (~${emojiPct}%)`);

    const punctuationDesc = lowerRatio > 0.55 ? 'Playful & casual rhythm' : 'Standard conversational punctuation';

    const whatAiNoticed = `You tend to text in ${avgWords <= 6 ? 'punchy, concise phrases' : (avgWords >= 14 ? 'detailed, expressive messages' : 'balanced conversational sentences')} with ${emoji === 'heavy' ? 'frequent expressive emojis' : (emoji !== 'none' ? 'occasional natural emojis' : 'no emojis')} and ${lowerRatio > 0.55 ? 'a casual lowercase rhythm' : 'proper punctuation'}.`;

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
      lengthTrait: length === 'short' ? 'Short messages' : (length === 'long' ? 'Detailed messages' : 'Medium messages'),
      emojiTrait: emoji === 'none' ? 'No emoji' : (emoji === 'heavy' ? 'Heavy emoji' : (emoji === 'moderate' ? 'Moderate emoji' : 'Light emoji')),
      toneTrait: tone === 'playful-casual' ? 'Playful & casual' : (tone === 'formal' ? 'Formal tone' : 'Casual tone'),
      followUpTrait: asksQuestions ? 'Asks follow-ups' : 'Statement style',
    };
  };

  // ─── Chat Style Trainer Logic (Desktop V2 Multi-Language Parity) ───
  const startTrainingSession = (langCode, forceFresh = false) => {
    const targetLang = langCode || trainingLang || 'en';
    setTrainingLang(targetLang);
    const existing = form?.chatStyleProfiles?.[targetLang];
    const persona = getPersonaForLang(targetLang);

    // If continuing an existing partial session, restore all saved conversation messages
    if (!forceFresh && existing?.partial && existing?.savedMessages && existing.savedMessages.length > 0) {
      setChatMessages([...existing.savedMessages]);
      setSessionCompleted(false);
      setStyleView('chat');
      return;
    }

    // Fresh session start
    setChatMessages([
      { id: '1', sender: 'match', text: persona.opener, personaName: persona.name }
    ]);
    setSessionCompleted(false);
    setStyleView('chat');
  };

  const restartTrainingSession = () => {
    const persona = getPersonaForLang(trainingLang);
    setChatMessages([
      { id: '1', sender: 'match', text: persona.opener, personaName: persona.name }
    ]);
    setSessionCompleted(false);
  };

  // ─── Dynamic AI Match Reply Generator (Desktop V2 handleStyleTrainingReply Parity) ───
  const generateAIMatchReply = async (conversation, personaName, targetLang, lastWasGarbage, isFinal) => {
    const apiKey = form?.apiKey || settings?.apiKey;
    const model = form?.aiModel || settings?.aiModel || 'gpt-4o-mini';

    // 1. Live OpenAI generation if API key is present (exact Desktop V2 parity)
    if (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 10) {
      try {
        const rtc = form?.remoteStyleTrainingConfig || {};
        const trainingReplySystemPrompt = rtc.trainingReplySystemPrompt || null;
        const trainingReplyFinalPrompt  = rtc.trainingReplyFinalPrompt  || null;
        const trainingReplyTemperature  = (typeof rtc.trainingReplyTemperature === 'number') ? rtc.trainingReplyTemperature : 0.7;
        const trainingReplyMaxTokens    = (typeof rtc.trainingReplyMaxTokens   === 'number') ? rtc.trainingReplyMaxTokens   : 100;
        const personaEmojiEnabled       = (typeof rtc.personaEmojiEnabled === 'boolean') ? rtc.personaEmojiEnabled : true;
        const emojiInstruction = personaEmojiEnabled ? '' : '\nDo NOT use any emojis in your reply.';

        const LANG_MAP = {
          en:'English', es:'Spanish', fr:'French', de:'German', it:'Italian',
          pt:'Portuguese', ru:'Russian', zh:'Chinese', ja:'Japanese', ko:'Korean',
          ar:'Arabic', hi:'Hindi', nl:'Dutch', pl:'Polish', tr:'Turkish',
          sv:'Swedish', da:'Danish', fi:'Finnish', nb:'Norwegian', cs:'Czech',
          sk:'Slovak', ro:'Romanian', hu:'Hungarian', el:'Greek', he:'Hebrew',
          uk:'Ukrainian', id:'Indonesian', ms:'Malay', vi:'Vietnamese',
          th:'Thai', fa:'Persian', ur:'Urdu', sw:'Swahili', bn:'Bengali',
        };

        const ROMANIZED_LANGS = {
          hi: 'Hinglish (Hindi written in English/Latin script, the way Indians actually text — e.g. "kese ho", "kya chal raha hai", "bahut badhiya")',
          ur: 'Urdu written in Latin/Roman script (the way Pakistani users actually text — e.g. "kya haal hai", "bohat acha")',
          bn: 'Bengali written in Latin/Roman script (the way users actually text — e.g. "ki korcho", "bhalo acho")',
        };

        const langInstruction = ROMANIZED_LANGS[targetLang]
          ? `\nIMPORTANT: Write ALL your messages in ${ROMANIZED_LANGS[targetLang]}. Do NOT use native script (Devanagari, Arabic, Bengali). Use Latin letters only, exactly like real texters do.`
          : (targetLang && targetLang !== 'en' && LANG_MAP[targetLang])
            ? `\nIMPORTANT: Write ALL your messages in ${LANG_MAP[targetLang]}. Every word must be in ${LANG_MAP[targetLang]}.`
            : '';

        const historyLines = (conversation || [])
          .slice(-8)
          .map(m => `${m.sender === 'user' || m.role === 'user' ? 'User' : personaName}: ${m.text}`)
          .join('\n');

        const garbageInstruction = lastWasGarbage
          ? `\nIMPORTANT: The user just sent a nonsensical/random reply (keyboard mash or gibberish). React naturally — tease them lightly or call it out in a playful way, then redirect and ask them a real question. Do NOT play along as if it made sense.`
          : '';

        const systemPrompt = isFinal
          ? (trainingReplyFinalPrompt
              ? trainingReplyFinalPrompt.replace(/\{personaName\}/g, personaName) + langInstruction + emojiInstruction
              : `You are ${personaName}, an attractive person on a dating app wrapping up a great conversation.
React warmly and genuinely to their last message. Keep it short (1 sentence), casual, and real — like you actually enjoyed talking to them. No questions. No "let's do this again". No formal goodbyes. Just a natural, warm closing moment.${langInstruction}${emojiInstruction}`)
          : (trainingReplySystemPrompt
              ? trainingReplySystemPrompt.replace(/\{personaName\}/g, personaName) + garbageInstruction + langInstruction + emojiInstruction
              : `You are ${personaName}, an attractive person on Tinder having a real conversation with someone you're interested in.
Your goal is to keep the conversation fun, flirty, and naturally build attraction — like a real date would.
Guidelines:
- React to what they said, then pivot toward getting to know them better romantically or personally
- Mix light flirting with genuine curiosity about them as a person
- Occasionally tease playfully or drop a subtle compliment
- Keep replies SHORT (1-2 sentences). Casual texting style, no formal punctuation
- Ask questions that move toward meeting up, learning their vibe, or finding chemistry
- Topics: lifestyle, personality, humor, adventures, attraction — NOT just logistics or food facts
NEVER mention you are an AI or a simulation. Sound like a real attractive person who's interested.${garbageInstruction}${langInstruction}${emojiInstruction}`);

        const userPrompt = `Here is the conversation so far:\n${historyLines}\n\nWrite ${personaName}'s next reply. Output ONLY the message text, no name prefix, no quotes:`;

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({
            model,
            temperature: trainingReplyTemperature,
            max_tokens: trainingReplyMaxTokens,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ]
          })
        });

        if (res.ok) {
          const data = await res.json();
          let reply = data.choices?.[0]?.message?.content || '';
          reply = reply.trim()
            .replace(/^["'\u2018\u2019\u201c\u201d]+|["'\u2018\u2019\u201c\u201d]+$/g, '')
            .replace(new RegExp(`^${personaName}\\s*:\\s*`, 'i'), '')
            .trim();
          if (reply) return reply;
        }
      } catch (err) {
        console.warn('[AutomationV2] Live AI generation error, using contextual fallback engine:', err);
      }
    }

    // 2. Smart Contextual Conversation Engine (handles greetings, questions, short replies naturally)
    const persona = getPersonaForLang(targetLang);
    const lastUserMsg = conversation.filter(m => m.sender === 'user' || m.role === 'user').slice(-1)[0]?.text || '';
    const cleanLower = lastUserMsg.toLowerCase().trim();

    if (lastWasGarbage) {
      return "haha what does that even mean? 😂 tell me something real about you!";
    }

    // Contextual greeting detection: "hi", "hello", "hey", "hey what's up"
    if (/^(hi|hey|hello|heyy|heyyy|yo|howdy|sup|what's up|whats up|hola|bonjour|ciao|namaste|hlo)\b/i.test(cleanLower) && cleanLower.split(/\s+/).length <= 4) {
      const greetingReplies = [
        `hey! how's your day going so far? 😊`,
        `hey there :) what are you up to today?`,
        `hey! glad we matched 👀 what did you get up to this weekend?`,
      ];
      return greetingReplies[Math.floor(Math.random() * greetingReplies.length)];
    }

    // Contextual question response
    if (cleanLower.includes('?')) {
      const questionReplies = [
        "haha good question! honestly i love spontaneous trips and finding hidden coffee spots ☕ what about you?",
        "definitely into good music, travel and fun weekend plans! what's your vibe?",
        "honestly just relaxing and enjoying good conversations :) what do you do for fun?",
      ];
      return questionReplies[Math.floor(Math.random() * questionReplies.length)];
    }

    // Conversational follow-ups
    const validCount = conversation.filter(m => (m.sender === 'user' || m.role === 'user') && !m.garbage).length;
    const replyIdx = Math.min(validCount - 1, persona.replies.length - 1);
    return persona.replies[replyIdx] || "haha love that energy! what's something you're passionate about lately?";
  };

  const sendPracticeMessage = async () => {
    const userText = inputPracticeMsg.trim();
    if (!userText || sessionCompleted || calibrating) return;

    // Desktop V2 MIN_MESSAGE_CHARS = 4 validation
    if (userText.length < 4) {
      setInputShaking(true);
      setInputWarning("Write at least a few words, like you'd actually text someone.");
      setTimeout(() => setInputShaking(false), 1200);
      setTimeout(() => setInputWarning(''), 2500);
      return;
    }

    setInputWarning('');
    setInputShaking(false);
    setInputPracticeMsg('');

    const isGarbage = isGarbageMessage(userText);
    const newMsgObj = {
      id: String(Date.now()),
      sender: 'user',
      text: userText,
      garbage: isGarbage,
    };

    let updatedMsgs = [...chatMessages, newMsgObj];

    if (isGarbage) {
      updatedMsgs.push({
        id: String(Date.now() + 1),
        sender: 'system',
        text: "That doesn't look like a real reply. Write something you'd actually send to someone you're interested in.",
      });
    }

    setChatMessages(updatedMsgs);

    const validCount = updatedMsgs.filter(m => m.sender === 'user' && !m.garbage).length;
    const persona = getPersonaForLang(trainingLang);
    const isFinal = validCount >= 12;

    setCalibrating(true);

    try {
      const matchReply = await generateAIMatchReply(updatedMsgs, persona.name, trainingLang, isGarbage, isFinal);
      setChatMessages(prev => [
        ...prev,
        { id: String(Date.now() + 2), sender: 'match', text: matchReply, personaName: persona.name }
      ]);
      if (isFinal) {
        setSessionCompleted(true);
      }
    } catch (_) {
      const fallbackReply = persona.replies[Math.min(validCount - 1, persona.replies.length - 1)] || "haha tell me more about that!";
      setChatMessages(prev => [
        ...prev,
        { id: String(Date.now() + 2), sender: 'match', text: fallbackReply, personaName: persona.name }
      ]);
    } finally {
      setCalibrating(false);
    }
  };

  const generateAIStyleSummary = async (userMessages) => {
    const apiKey = form?.apiKey || settings?.apiKey;
    const model = form?.aiModel || settings?.aiModel || 'gpt-4o-mini';

    if (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 10 && userMessages?.length) {
      try {
        const rtc = form?.remoteStyleTrainingConfig || {};
        const summarySystemPrompt = rtc.summarySystemPrompt
          || `You are a communication style analyst. Based on someone's real text messages, write a single honest, specific, plain-English sentence (max 25 words) describing how they text. Address them directly using "You" — e.g. "You keep things short and direct..." Focus on what actually stands out — their energy, pace, directness, warmth, or humor. No generic filler. No em dashes. No bullet points. Just one sentence starting with "You".`;
        const summaryTemperature = (typeof rtc.summaryTemperature === 'number') ? rtc.summaryTemperature : 0.7;
        const summaryMaxTokens   = (typeof rtc.summaryMaxTokens   === 'number') ? rtc.summaryMaxTokens   : 60;

        const examples = (userMessages || []).slice(0, 12).map(m => `- "${m}"`).join('\n');
        const userPrompt = `Here are their messages:\n${examples}\n\nDescribe their texting style in one sentence:`;

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({
            model,
            temperature: summaryTemperature,
            max_tokens: summaryMaxTokens,
            messages: [
              { role: 'system', content: summarySystemPrompt },
              { role: 'user', content: userPrompt }
            ]
          })
        });

        if (res.ok) {
          const data = await res.json();
          const clean = (data.choices?.[0]?.message?.content || '').trim()
            .replace(/^["'\u201c\u201d]+|["'\u201c\u201d]+$/g, '')
            .replace(/\s—\s/g, ', ').replace(/—/g, ', ')
            .trim();
          if (clean) return clean;
        }
      } catch (err) {
        console.warn('[AutomationV2] Style summary generation error:', err);
      }
    }
    return null;
  };

  const finishAndSaveSession = async () => {
    const userMessages = chatMessages.filter(m => (m.sender === 'user' || m.role === 'user')).map(m => m.text);
    const validMessages = userMessages.filter(m => !isGarbageMessage(m));
    const minQualityRatio = form?.remoteStyleTrainingConfig?.minQualityRatio ?? 0.5;

    if (userMessages.length > 0 && (validMessages.length / userMessages.length) < minQualityRatio) {
      setStyleView('lowQuality');
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
    updateField('chatStyleProfiles', updatedProfiles);
    updateField('chatStyleProfile', updatedProfiles[trainingLang]);
    setViewingLang(trainingLang);
    setStyleView('insights');
  };

  const saveStyleInline = async () => {
    const validCount = chatMessages.filter(m => m.sender === 'user' && !m.garbage).length;
    if (validCount > 0) {
      const persona = getPersonaForLang(trainingLang);
      const analysis = analyzeUserStyle(chatMessages);
      const userMessages = chatMessages.filter(m => (m.sender === 'user' || m.role === 'user') && !m.garbage).map(m => m.text);
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
      updateField('chatStyleProfiles', updatedProfiles);
      updateField('chatStyleProfile', updatedProfiles[trainingLang]);
      setInlineSaved(true);
      setTimeout(() => setInlineSaved(false), 3000);
    }
  };

  const savePartialSession = () => {
    saveStyleInline();
    setStyleView('intro');
  };

  const handleSwitchSimLanguage = (newCode) => {
    setSimLangModalOpen(false);
    if (!newCode || newCode === trainingLang) return;

    const validCount = chatMessages.filter(m => m.sender === 'user' && !m.garbage).length;

    const doSwitch = () => {
      setTrainingLang(newCode);
      const existing = form?.chatStyleProfiles?.[newCode];
      if (existing?.partial && existing?.savedMessages && existing.savedMessages.length > 0) {
        setChatMessages([...existing.savedMessages]);
      } else {
        const persona = getPersonaForLang(newCode);
        setChatMessages([
          { id: '1', sender: 'match', text: persona.opener, personaName: persona.name }
        ]);
      }
      setSessionCompleted(false);
      setInputWarning('');
      setInputShaking(false);
      updateField('conversationLanguage', newCode);
    };

    if (validCount >= 3) {
      const targetLabel = LANGUAGE_OPTIONS.find(l => l.code === newCode)?.label || newCode;
      Alert.alert(
        `Switch to ${targetLabel}?`,
        `You've sent ${validCount} messages in this session. Switching language will load that language's training session.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Switch', onPress: doSwitch }
        ]
      );
    } else {
      doSwitch();
    }
  };

  const trainAnotherLanguage = () => {
    const profiles = form?.chatStyleProfiles || {};
    const untrained = LANGUAGE_OPTIONS.find(l => !profiles[l.code]?.trained);
    const nextLang = untrained?.code || (trainingLang === 'en' ? 'es' : 'en');
    setTrainingLang(nextLang);
    setStyleView('intro');
  };

  const deleteProfile = (langCode) => {
    const label = LANGUAGE_OPTIONS.find(l => l.code === langCode)?.label || langCode;
    Alert.alert(
      `Delete ${label} style?`,
      `This will permanently remove your trained ${label} profile. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedProfiles = { ...(form.chatStyleProfiles || {}) };
            delete updatedProfiles[langCode];
            updateField('chatStyleProfiles', updatedProfiles);
            if (form.chatStyleProfile?.trainingLanguage === langCode) {
              updateField('chatStyleProfile', null);
            }
            setStyleView('intro');
          }
        }
      ]
    );
  };

  if (loading || !form) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="small" color={uiTheme.colors.accent} />
        <Text style={styles.loadingText} accessibilityRole="progressbar" accessibilityLabel="Syncing Automation V2 configuration">Syncing Automation V2 configuration...</Text>
      </View>
    );
  }

  // ─── Collapsed Summary Chip Generators ───
  const getGoalSummary = () => {
    const goalObj = GOAL_OPTIONS.find(g => g.id === form?.goal) || GOAL_OPTIONS[0];
    return goalObj.label;
  };

  const getContactSummary = () => {
    if (form.contactDetails?.whatsapp?.value) return `WA: ${form.contactDetails.whatsapp.value}`;
    if (form.contactDetails?.instagram?.value) return `IG: @${form.contactDetails.instagram.value.replace('@', '')}`;
    // if (form.contactDetails?.telegram?.value) return `TG: @${form.contactDetails.telegram.value.replace('@', '')}`;
    return 'No handle set';
  };

  const isSafetyOn = form?.safetyMode !== false;
  const isAutoSwipeOn = form?.autoSwipe !== false && (form?.likesPerCycle ?? 50) > 0;
  const isAutoMessagingOn = form?.autoMessage !== false && (form?.messagesPerCycle ?? 50) > 0;

  const getSwipingSummary = () => {
    const likes = !isAutoSwipeOn ? 'Auto Swipe Off' : (isSafetyOn ? 'Auto Swipe (Safe)' : 'Auto Swipe On');
    const pacing = (form?.scheduleInterval === 120) ? 'Every 2 Hours' : ((form?.scheduleInterval === 60) ? 'Every Hour' : 'Every 30 min');
    const age = form?.ageFilter?.enabled ? `Age: ${form?.ageFilter?.min ?? 20}-${form?.ageFilter?.max ?? 35}` : 'Age: All';
    return { likes, pacing, age };
  };

  const getMessagingSummary = () => {
    const messaging = !isAutoMessagingOn ? 'Messaging Off' : (isSafetyOn ? 'Auto Messaging (Safe)' : 'Auto Messaging On');
    const toneVal = form?.tone || form?.chattingStyle || 'Freestyle';
    const tone = `${toneVal.charAt(0).toUpperCase() + toneVal.slice(1)}`;
    const intentionObj = INTENTIONS_OPTIONS.find(i => i.id === form?.intentions) || { label: 'Short term dating' };
    const intention = intentionObj.label.split(' ').slice(0, 3).join(' ');
    const langObj = LANGUAGE_OPTIONS.find(l => l.code === (form?.conversationLanguage || 'en')) || { label: 'English', flag: '🇺🇸' };
    const lang = `${langObj.flag} ${langObj.label}`;
    const priorityVal = form?.prioritySlider ?? form?.minReplySlots ?? 50;
    const priority = priorityVal === 30 ? '70 : 30' : (priorityVal === 70 ? '30 : 70' : '50 : 50');
    const emojis = form?.useEmojis !== false ? 'Emojis On' : 'No Emojis';
    const consecutive = form?.consecutiveMessagesEnabled ? 'Multi-text' : null;
    return { messaging, tone, intention, lang, priority, emojis, consecutive };
  };

  const getStyleSummary = () => {
    const profiles = form?.chatStyleProfiles || {};
    const legacy = form?.chatStyleProfile;
    if (legacy?.trained && !profiles[legacy.trainingLanguage || 'en']) {
      profiles[legacy.trainingLanguage || 'en'] = legacy;
    }
    const trainedLangs = Object.keys(profiles).filter(k => profiles[k]?.trained);
    if (!trainedLangs.length) return [{ label: 'No style trained yet', full: false }];
    return trainedLangs.map(code => {
      const p = profiles[code];
      const langObj = LANGUAGE_OPTIONS.find(l => l.code === code) || { label: code, flag: '🌐' };
      if (p.partial) {
        return { label: `${langObj.flag} ${langObj.label} ${p.messageCount || 0}/12`, full: false };
      }
      return { label: `✓ ${langObj.flag} ${langObj.label}`, full: true };
    });
  };

  const getActiveTimeSummary = () => {
    if (form.activeHours?.enabled === false) return '24/7 (Always Active)';
    const start = minsToDisplay(timeToMins(form.activeHours?.startTime || '09:00'));
    const end = minsToDisplay(timeToMins(form.activeHours?.endTime || '22:00'));
    return `${start} – ${end}`;
  };

  // ─── Redesigned page: derived display values (read-only views of `form`) ───
  let selectedGoalIds = Array.isArray(form.selectedGoals) && form.selectedGoals.length > 0
    ? form.selectedGoals.map(g => g === 'never_stop' ? 'never' : g)
    : [form.goal || 'never'];
  if (selectedGoalIds.includes('never') || selectedGoalIds.length === 0) {
    selectedGoalIds = ['never'];
  }
  const isNeverActive = selectedGoalIds.includes('never');
  const activeGoalId = selectedGoalIds[0] || 'never';
  const activeGoal = GOAL_OPTIONS.find(g => g.id === activeGoalId)
    || { id: activeGoalId, label: 'Custom goal', desc: 'Pick a goal below to change how the wingman steers chats', icon: 'flag-outline' };
  // Mirrors what gets saved (handleSavePress treats a missing goal as 'never').
  const stopAfterGoalOn = form.stopAfterGoal !== false && !isNeverActive;
  const instagramEnabled = form.contactDetails?.instagram?.enabled !== false;
  const whatsappEnabled = form.contactDetails?.whatsapp?.enabled !== false;
  const currentGender = (form.userGenderOverride || 'auto').toLowerCase();
  const handleBadge = (enabled, value, name) => {
    if (!enabled) return { tone: 'neutral', label: `${name} off` };
    return String(value || '').trim() ? { tone: 'success', label: `${name} ready` } : { tone: 'warning', label: `${name} missing` };
  };
  const instagramBadge = handleBadge(instagramEnabled, form.contactDetails?.instagram?.value, 'Instagram');
  // Short name of the goal for the journey strip (Match → Chat → goal).
  const GOAL_STEP = { date: 'Date', phone: 'WhatsApp', instagram: 'Socials', never: 'Keep chatting' };
  const goalStep = isNeverActive ? 'Keep chatting' : selectedGoalIds.map(id => GOAL_STEP[id] || id).join(' / ');

  const handleGoalPress = (goalId) => {
    let current = Array.isArray(form.selectedGoals) && form.selectedGoals.length > 0
      ? form.selectedGoals.map(g => g === 'never_stop' ? 'never' : g)
      : [form.goal || 'never'];

    if (goalId === 'never' || goalId === 'never_stop') {
      // If user chooses keep engaging, all other options are cleared!
      updateFields({
        selectedGoals: ['never'],
        goal: 'never',
        stopConditions: [],
        stopAfterGoal: false,
      });
      return;
    }

    // User chooses one of the 3 specific options (date, phone, instagram)
    // Remove 'never' since keep engaging is mutually exclusive
    let filtered = current.filter(g => g !== 'never' && g !== 'never_stop');

    if (filtered.includes(goalId)) {
      filtered = filtered.filter(g => g !== goalId);
      // If no options remain, fall back to Keep Engaging ('never')
      if (filtered.length === 0) {
        filtered = ['never'];
      }
    } else {
      // Add this option (up to 3)
      filtered.push(goalId);
    }

    const isNever = filtered.includes('never') || filtered.length === 0;
    const newSelected = isNever ? ['never'] : filtered;
    const primaryGoal = isNever ? 'never' : newSelected[0];

    updateFields({
      selectedGoals: newSelected,
      goal: primaryGoal,
      stopConditions: isNever ? [] : newSelected,
      stopAfterGoal: !isNever && form.stopAfterGoal !== false,
    });
  };
  const handleState = (enabled, value) => (!enabled ? 'off' : String(value || '').trim() ? 'ready' : 'missing');
  const HANDLE_STATE = {
    ready: { label: 'Ready', icon: 'checkmark-circle', color: uiTheme.colors.success },
    missing: { label: 'Missing', icon: 'alert-circle', color: uiTheme.colors.warning },
    off: { label: 'Off', icon: 'remove-circle-outline', color: uiTheme.colors.muted },
  };
  const whatsappBadge = handleBadge(whatsappEnabled, form.contactDetails?.whatsapp?.value, 'WhatsApp');
  // Animates the input reveal/collapse, then applies the exact same field update as before.
  const toggleHandle = (path, value) => {
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.create(uiTheme.motion.normal, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    updateField(path, value);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { maxWidth: contentMax }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ════════════════════ WINGMAN MISSION CARD ════════════════════ */}
        <FadeIn>
          <LinearGradient
            colors={[alpha(uiTheme.gradients.brand[0], 0.7), alpha(uiTheme.gradients.brand[uiTheme.gradients.brand.length - 1], 0.35), alpha(uiTheme.colors.border, 0.4)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.wmFrame}
          >
            <View style={styles.wmCard}>
              <LinearGradient colors={uiTheme.gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Ionicons name={activeGoal.icon} size={150} color={alpha(uiTheme.colors.white, 0.04)} style={styles.wmWatermark} />

              {/* Header: wingman + mode */}
              <View style={styles.wmHeader}>
                <View style={styles.wmLabelRow}>
                  <LiveDot size={7} color={uiTheme.colors.success} />
                  <AppText variant="overline" color="secondary">WINGMAN</AppText>
                </View>
                <View style={[styles.wmModePill, stopAfterGoalOn && styles.wmModePillOn]}>
                  <Ionicons name={stopAfterGoalOn ? 'flag' : 'infinite'} size={12} color={stopAfterGoalOn ? uiTheme.colors.secondary : uiTheme.colors.muted} />
                  <Text style={[styles.wmModeText, stopAfterGoalOn && { color: uiTheme.colors.secondary }]} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                    {stopAfterGoalOn ? 'Stops after goal' : 'Keeps chatting'}
                  </Text>
                </View>
              </View>

              {/* Goal */}
              <ContentTransition transitionKey={activeGoalId} style={styles.wmGoal}>
                <LinearGradient colors={uiTheme.gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.wmGoalIcon}>
                  <Ionicons name={activeGoal.icon} size={26} color={uiTheme.colors.onPrimary} />
                </LinearGradient>
                <View style={styles.wmGoalCopy}>
                  <AppText variant="footnote" color="muted">Aiming for</AppText>
                  <AppText variant="title2" numberOfLines={2} accessibilityRole="header">{activeGoal.label}</AppText>
                  <AppText variant="footnote" color="textSecondary" numberOfLines={2}>{activeGoal.desc}</AppText>
                </View>
              </ContentTransition>

              {/* Journey: Match → Chat → goal */}
              <View style={styles.wmJourney} accessible accessibilityLabel={`Journey: match, chat, ${goalStep}`}>
                {[
                  { icon: 'heart', label: 'Match' },
                  { icon: 'chatbubbles', label: 'Chat' },
                  { icon: activeGoalId === 'never' ? 'infinite' : activeGoal.icon, label: goalStep, goal: true },
                ].map((step, index) => (
                  <React.Fragment key={step.label + index}>
                    {index > 0 ? (
                      <LinearGradient
                        colors={[alpha(uiTheme.colors.accent, 0.25), alpha(uiTheme.colors.accent, 0.6)]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={styles.wmJourneyLine}
                      />
                    ) : null}
                    <View style={styles.wmStep}>
                      {step.goal ? (
                        <LinearGradient colors={uiTheme.gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.wmStepDot}>
                          <Ionicons name={step.icon} size={14} color={uiTheme.colors.onPrimary} />
                        </LinearGradient>
                      ) : (
                        <View style={[styles.wmStepDot, styles.wmStepDotPlain]}>
                          <Ionicons name={step.icon} size={13} color={uiTheme.colors.accent} />
                        </View>
                      )}
                      <Text style={[styles.wmStepLabel, step.goal && styles.wmStepLabelGoal]} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                        {step.label}
                      </Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>

              {/* Contact readiness */}
              <View style={styles.wmHandles}>
                {[
                  { key: 'instagram', icon: 'logo-instagram', name: 'Instagram', state: handleState(instagramEnabled, form.contactDetails?.instagram?.value) },
                  { key: 'whatsapp', icon: 'logo-whatsapp', name: 'WhatsApp', state: handleState(whatsappEnabled, form.contactDetails?.whatsapp?.value) },
                ].map((item) => {
                  const st = HANDLE_STATE[item.state];
                  return (
                    <View key={item.key} style={styles.wmHandle} accessible accessibilityLabel={`${item.name} ${st.label}`}>
                      <Ionicons name={item.icon} size={16} color={uiTheme.colors.textSecondary} />
                      <View style={styles.wmHandleCopy}>
                        <Text style={styles.wmHandleName} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{item.name}</Text>
                        <View style={styles.wmHandleStateRow}>
                          <Ionicons name={st.icon} size={11} color={st.color} />
                          <Text style={[styles.wmHandleState, { color: st.color }]} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{st.label}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </LinearGradient>
        </FadeIn>

        {/* Previous summary card (kept for reference).
        {/-* ════════════════════ PAGE INTRO: WHAT THE WINGMAN IS AIMING FOR ════════════════════ *-/}
        <FadeIn>
          <View style={styles.heroCard}>
            <LinearGradient colors={uiTheme.gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <ContentTransition transitionKey={activeGoalId} style={styles.heroTop}>
              <IconWell icon={activeGoal.icon} tone="primary" size={52} />
              <View style={styles.heroCopy}>
                <AppText variant="overline" color="secondary" numberOfLines={1}>WINGMAN IS AIMING FOR</AppText>
                <AppText variant="title2" numberOfLines={2} style={styles.heroTitle}>{activeGoal.label}</AppText>
                <AppText variant="footnote" color="textSecondary" numberOfLines={2}>{activeGoal.desc}</AppText>
              </View>
            </ContentTransition>
            <View style={styles.heroDivider} />
            <View style={styles.heroBadges} accessible accessibilityLabel={`${stopAfterGoalOn ? 'Stops after goal' : 'Keeps chatting'}, ${instagramBadge.label}, ${whatsappBadge.label}`}>
              <Badge
                tone={stopAfterGoalOn ? 'secondary' : 'neutral'}
                icon={stopAfterGoalOn ? 'flag-outline' : 'infinite-outline'}
                label={stopAfterGoalOn ? 'Stops after goal' : 'Keeps chatting'}
                style={styles.heroBadge}
                textStyle={styles.heroBadgeText}
              />
              <Badge tone={instagramBadge.tone} icon="logo-instagram" label={instagramBadge.label} style={styles.heroBadge} textStyle={styles.heroBadgeText} />
              <Badge tone={whatsappBadge.tone} icon="logo-whatsapp" label={whatsappBadge.label} style={styles.heroBadge} textStyle={styles.heroBadgeText} />
            </View>
          </View>
        </FadeIn>

        */}

        {/* ════════════════════ SECTION: DATING GOAL ════════════════════ */}
        <View style={styles.pageSection}>
          <FadeIn delay={50}>
            <SectionHeader
              title="Dating goal"
              description={isNeverActive
                ? "Keep Engaging is active — continuous natural AI conversation on-app with no rush."
                : "Select up to 3 goals. Choose Keep Engaging anytime to clear all and chat non-stop."}
            />
          </FadeIn>
          <View style={[styles.goalList, optionCols > 1 && styles.goalGrid]} accessibilityRole="group" accessibilityLabel="Dating Goals">
            {GOAL_OPTIONS.map((option, idx) => {
              const isSelected = selectedGoalIds.includes(option.id);
              return (
                <FadeIn key={option.id} delay={100 + idx * 40} style={optionItemStyle}>
                  <GoalOptionCard
                    option={option}
                    selected={isSelected}
                    onPress={() => handleGoalPress(option.id)}
                  />
                </FadeIn>
              );
            })}
          </View>
          <FadeIn delay={320}>
            <Card padding="none" style={styles.groupCard}>
              <View style={[styles.settingRow, isNeverActive && styles.settingRowDisabled]}>
                <IconWell icon="flag-outline" tone={stopAfterGoalOn ? 'secondary' : 'neutral'} size={40} />
                <View style={styles.settingRowCopy}>
                  <AppText variant="bodyStrong" numberOfLines={1}>Stop After Goal</AppText>
                  <AppText variant="footnote" numberOfLines={2} style={styles.settingRowSub}>
                    {isNeverActive ? 'Not used while Keep Engaging is selected' : 'Stop messaging a match once any selected goal is reached'}
                  </AppText>
                </View>
                <Switch
                  accessibilityLabel="Stop After Goal"
                  value={form.stopAfterGoal !== false && !isNeverActive}
                  disabled={isNeverActive}
                  onValueChange={v => updateField('stopAfterGoal', v)}
                  trackColor={{ false: uiTheme.colors.elevatedHigh, true: uiTheme.colors.primary }}
                  thumbColor={uiTheme.colors.white}
                  ios_backgroundColor={uiTheme.colors.elevatedHigh}
                />
              </View>
            </Card>
          </FadeIn>
        </View>

        {/* ════════════════════ SECTION: CONTACT HANDLES ════════════════════ */}
        <FadeIn delay={370} style={styles.pageSection}>
          <SectionHeader title="Your contact details" description="Toggle on the details you want the AI to share when a match asks for your contact." />
          <Card padding="none" style={[styles.groupCard, handleCols > 1 && styles.handleGridCard]}>
            <ContactHandleRow
              icon="logo-instagram"
              tone="primary"
              title="Instagram"
              switchLabel="Share Instagram"
              enabled={instagramEnabled}
              onToggle={v => toggleHandle('contactDetails.instagram.enabled', v)}
              sentCount={form.handleSentStats?.instagram || 0}
              value={form.contactDetails?.instagram?.value}
              inputLabel="Your Instagram handle"
              missingHint="Add your handle so the wingman can share it."
              style={handleCols > 1 ? styles.handleGridCell : null}
              divider={handleCols === 1}
              inputProps={{
                placeholder: '@yourhandle',
                accessibilityLabel: 'Instagram handle',
                autoCapitalize: 'none',
                textContentType: 'username',
                onChangeText: val => updateField('contactDetails.instagram.value', val),
              }}
            />
            <ContactHandleRow
              icon="logo-whatsapp"
              tone="success"
              title="WhatsApp"
              switchLabel="Share WhatsApp"
              enabled={whatsappEnabled}
              onToggle={v => toggleHandle('contactDetails.whatsapp.enabled', v)}
              sentCount={form.handleSentStats?.whatsapp || 0}
              value={form.contactDetails?.whatsapp?.value}
              inputLabel="Your WhatsApp number"
              missingHint="Add your number so the wingman can share it."
              style={handleCols > 1 ? [styles.handleGridCell, styles.handleGridCellSplit] : null}
              inputProps={{
                placeholder: '+1 555 000 0000',
                accessibilityLabel: 'WhatsApp number',
                keyboardType: 'phone-pad',
                textContentType: 'telephoneNumber',
                onChangeText: val => updateField('contactDetails.whatsapp.value', val),
              }}
            />
          </Card>
        </FadeIn>

        {/* ════════════════════ SECTION: ABOUT YOU (GENDER) ════════════════════ */}
        <FadeIn delay={420} style={styles.pageSection}>
          <SectionHeader title="Your gender" description="Used for grammar in AI messages." />
          <Card padding="md" style={styles.groupCard}>
            <SegmentedControl
              options={GENDER_OPTIONS}
              value={currentGender}
              onChange={id => updateField('userGenderOverride', id)}
              accessibilityLabel="Your gender"
            />
            <View style={styles.genderHintRow}>
              <Ionicons name="sparkles-outline" size={13} color={uiTheme.colors.muted} />
              <AppText variant="footnote" style={styles.genderHintText}>
                Auto = detected from your profile. Set manually if Auto is wrong.
              </AppText>
            </View>
          </Card>
        </FadeIn>

        {/* ════════════════════ SECTION: SMART MATCH INTELLIGENCE ════════════════════ */}
        {(() => {
          const userProfile = form?.userProfile || settings?.userProfile;
          const isProfileSynced = Boolean(userProfile && userProfile.name);
          const syncTimestamp = userProfile?.syncedAt || userProfile?.lastSyncedAt;
          const syncAgeDays = syncTimestamp ? (Date.now() - syncTimestamp) / (1000 * 60 * 60 * 24) : 999;
          const isProfileValid = isProfileSynced && syncAgeDays <= 7;
          const isSmartMatchOn = form?.aiMatchEnabled === true;
          const currentThreshold = typeof form?.aiMatchThreshold === 'number' ? form.aiMatchThreshold : 60;
          const maxDistance = typeof form?.aiMatchMaxDistance === 'number' ? form.aiMatchMaxDistance : 0;

          return (
            <FadeIn delay={460} style={styles.pageSection}>
              <SectionHeader
                title="Smart Match Intelligence"
                description="AI analyzes compatibility against your profile to like the right matches."
              />
              <Card padding="none" style={styles.groupCard}>
                {/* Master Toggle Row */}
                <View style={styles.settingRow}>
                  <IconWell
                    icon="sparkles"
                    tone={isSmartMatchOn ? "primary" : "neutral"}
                    size={40}
                  />
                  <View style={styles.settingRowCopy}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <AppText variant="bodyStrong" numberOfLines={1}>Smart Match Mode</AppText>
                      {isSmartMatchOn && (
                        <Badge
                          tone={isProfileValid ? "primary" : "warning"}
                          label={isProfileValid ? "Active" : "Ready"}
                          style={{ paddingHorizontal: 6, paddingVertical: 1 }}
                        />
                      )}
                    </View>
                    <AppText variant="footnote" numberOfLines={2} style={styles.settingRowSub}>
                      {isSmartMatchOn
                        ? (isProfileValid
                            ? `Only auto-likes profiles with ≥ ${currentThreshold}% compatibility`
                            : 'Smart Match is ON. Will start scoring as soon as Tinder loads your profile.')
                        : 'Score profiles before swiping (currently OFF)'}
                    </AppText>
                  </View>
                  <Switch
                    accessibilityLabel="Smart Match Mode"
                    value={isSmartMatchOn}
                    onValueChange={v => {
                      updateField('aiMatchEnabled', v);
                      handleSavePress({ ...(formRef.current || form || {}), aiMatchEnabled: v });
                    }}
                    trackColor={{ false: uiTheme.colors.elevatedHigh, true: uiTheme.colors.primary }}
                    thumbColor={uiTheme.colors.white}
                    ios_backgroundColor={uiTheme.colors.elevatedHigh}
                  />
                </View>

                {!isProfileValid && isSmartMatchOn && (
                  <View style={{ padding: 12, backgroundColor: alpha(uiTheme.colors.warning, 0.08), borderTopWidth: 1, borderColor: alpha(uiTheme.colors.warning, 0.2), flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="information-circle-outline" size={16} color={uiTheme.colors.warning} />
                    <AppText variant="footnote" style={{ color: uiTheme.colors.warning, flex: 1 }}>
                      {!isProfileSynced
                        ? 'Profile sync pending. Smart Match is armed and will evaluate profiles as soon as Tinder loads.'
                        : 'Profile data is over 7 days old. Smart Match will refresh your profile automatically.'}
                    </AppText>
                  </View>
                )}

                {/* Sub-controls when Smart Match is ON */}
                {isSmartMatchOn && (
                  <View style={{ padding: 16, borderTopWidth: 1, borderColor: uiTheme.colors.border }}>
                    {/* Minimum Compatibility Threshold Slider */}
                    <View style={{ marginBottom: 18 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <AppText variant="bodyStrong">Minimum Compatibility</AppText>
                        <View style={styles.v2ValueBadge}>
                          <Text style={styles.v2ValueBadgeText}>{currentThreshold}%</Text>
                        </View>
                      </View>
                      <RangeSlider
                        min={30}
                        max={90}
                        step={5}
                        value={currentThreshold}
                        unit="%"
                        onValueChange={val => {
                          updateField('aiMatchThreshold', val);
                          handleSavePress({ ...(formRef.current || form || {}), aiMatchThreshold: val });
                        }}
                      />
                      <AppText variant="footnote" color="textSecondary" style={{ marginTop: 6 }}>
                        Profiles scoring below {currentThreshold}% will be passed automatically.
                      </AppText>
                    </View>

                    {/* Strict Relationship Goals Filter */}
                    <View style={[styles.rowBetween, { paddingVertical: 12, borderTopWidth: 1, borderColor: uiTheme.colors.border }]}>
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <AppText variant="bodyStrong">Filter by Relationship Goal</AppText>
                        <AppText variant="footnote" color="textSecondary" style={{ marginTop: 2 }}>
                          Automatically pass profiles whose dating intent conflicts with yours
                        </AppText>
                      </View>
                      <Switch
                        accessibilityLabel="Filter by Relationship Goal"
                        value={form?.aiMatchStrictGoals !== false}
                        onValueChange={v => {
                          updateField('aiMatchStrictGoals', v);
                          handleSavePress({ ...(formRef.current || form || {}), aiMatchStrictGoals: v });
                        }}
                        trackColor={{ false: uiTheme.colors.elevatedHigh, true: uiTheme.colors.primary }}
                        thumbColor={uiTheme.colors.white}
                        ios_backgroundColor={uiTheme.colors.elevatedHigh}
                      />
                    </View>

                    {/* Distance Limit Slider */}
                    <View style={{ paddingVertical: 12, borderTopWidth: 1, borderColor: uiTheme.colors.border }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <AppText variant="bodyStrong">Maximum Distance</AppText>
                        <View style={styles.v2ValueBadge}>
                          <Text style={styles.v2ValueBadgeText}>
                            {maxDistance > 0 ? `${maxDistance} mi` : 'No Limit (Off)'}
                          </Text>
                        </View>
                      </View>
                      <RangeSlider
                        min={0}
                        max={100}
                        step={5}
                        value={maxDistance}
                        unit=" mi"
                        onValueChange={val => {
                          updateField('aiMatchMaxDistance', val);
                          handleSavePress({ ...(formRef.current || form || {}), aiMatchMaxDistance: val });
                        }}
                      />
                      <AppText variant="footnote" color="textSecondary" style={{ marginTop: 6 }}>
                        {maxDistance > 0
                          ? `Pass profiles farther than ${maxDistance} miles.`
                          : 'No distance dealbreaker. Distance is only scored for proximity bonus.'}
                      </AppText>
                    </View>

                    {/* Deep AI Analysis Toggle */}
                    <View style={[styles.rowBetween, { paddingVertical: 12, borderTopWidth: 1, borderColor: uiTheme.colors.border }]}>
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <AppText variant="bodyStrong">Deep AI Analysis</AppText>
                        <AppText variant="footnote" color="textSecondary" style={{ marginTop: 2 }}>
                          Use advanced AI to evaluate profiles that are close to your match threshold.
                        </AppText>
                      </View>
                      <Switch
                        accessibilityLabel="Deep AI Analysis"
                        value={Boolean(form?.aiMatchUseLLM)}
                        onValueChange={v => {
                          updateField('aiMatchUseLLM', v);
                          handleSavePress({ ...(formRef.current || form || {}), aiMatchUseLLM: v });
                        }}
                        trackColor={{ false: uiTheme.colors.elevatedHigh, true: uiTheme.colors.primary }}
                        thumbColor={uiTheme.colors.white}
                        ios_backgroundColor={uiTheme.colors.elevatedHigh}
                      />
                    </View>

                    {/* Show Compatibility Scores Toggle */}
                    <View style={[styles.rowBetween, { paddingVertical: 12, borderTopWidth: 1, borderColor: uiTheme.colors.border }]}>
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <AppText variant="bodyStrong">Show Compatibility Scores</AppText>
                        <AppText variant="footnote" color="textSecondary" style={{ marginTop: 2 }}>
                          Display compatibility badges and breakdown chips on cards
                        </AppText>
                      </View>
                      <Switch
                        accessibilityLabel="Show Compatibility Scores"
                        value={form?.aiMatchShowScores !== false}
                        onValueChange={v => {
                          updateField('aiMatchShowScores', v);
                          handleSavePress({ ...(formRef.current || form || {}), aiMatchShowScores: v });
                        }}
                        trackColor={{ false: uiTheme.colors.elevatedHigh, true: uiTheme.colors.primary }}
                        thumbColor={uiTheme.colors.white}
                        ios_backgroundColor={uiTheme.colors.elevatedHigh}
                      />
                    </View>
                  </View>
                )}
              </Card>
            </FadeIn>
          );
        })()}

        {/* ════════════════════ CARD 1 (LEGACY ACCORDION LAYOUT, HIDDEN): YOUR DATING GOAL (V2 DESKTOP PARITY) ════════════════════ */}
        {SHOW_LEGACY_GOAL_ACCORDION && (
        <View style={[styles.v2Card, openCards.goal && styles.v2CardOpen]}>
          <TouchableOpacity accessibilityRole="button"
            accessibilityLabel="Your Dating Goal"
            accessibilityState={{ expanded: !!openCards.goal }}
            style={styles.v2CardHeader}
            onPress={() => toggleCard('goal')}
            activeOpacity={0.85}
          >
            <View style={styles.cardTitleWrap}>
              <IconWell icon="flag-outline" tone="primary" size={36} />
              <Text style={styles.v2CardTitle} numberOfLines={2} accessibilityRole="header">Your Dating Goal</Text>
            </View>
            <Ionicons
              name={openCards.goal ? "chevron-up" : "chevron-down"}
              size={20}
              color={openCards.goal ? uiTheme.colors.accent : uiTheme.colors.muted}
            />
          </TouchableOpacity>

          {/* Collapsed Summary Chips */}
          {!openCards.goal && (
            <View style={styles.collapsedRow}>
              <View style={styles.v2Chip}>
                <Ionicons name="locate" size={12} color={uiTheme.colors.accent} />
                <Text style={styles.v2ChipText} numberOfLines={1}>{getGoalSummary()}</Text>
              </View>
              <View style={styles.v2Chip}>
                <Text style={styles.v2ChipText} numberOfLines={1}>
                  {form.stopAfterGoal !== false && form.goal !== 'never' ? 'Stop After Goal' : 'Stop Off'}
                </Text>
              </View>
              <View style={styles.v2Chip}>
                <Ionicons name="chatbox" size={12} color={uiTheme.colors.accent} />
                <Text style={styles.v2ChipText} numberOfLines={1}>{getContactSummary()}</Text>
              </View>
            </View>
          )}

          {/* Expanded Card Body */}
          {openCards.goal && (
            <View style={styles.v2CardBody}>
              <Text style={styles.fieldDesc}>Select how the AI Wingman steers and closes conversations:</Text>

              {/* ─── Primary Dating Goal & Stop After Goal Box ─── */}
              <View style={styles.subBox}>
                <V2Dropdown
                  label="Primary Goal"
                  options={GOAL_OPTIONS.map(g => ({
                    id: g.id,
                    value: g.id,
                    label: g.label,
                    desc: g.desc,
                    icon: g.icon,
                  }))}
                  selectedValue={form.goal || 'never'}
                  onSelect={val => updateField('goal', val)}
                />

                <View style={styles.subBoxDivider} />

                {/* Stop After Goal Toggle */}
                <View style={[styles.rowBetween, styles.switchRow]}>
                  <Text style={[styles.toggleTitle, styles.flexText]}>Stop After Goal</Text>
                  <Switch
                    accessibilityLabel="Stop After Goal"
                    value={form.stopAfterGoal !== false && form.goal !== 'never'}
                    disabled={form.goal === 'never'}
                    onValueChange={v => updateField('stopAfterGoal', v)}
                    trackColor={{ false: uiTheme.colors.elevatedHigh, true: uiTheme.colors.primary }}
                    thumbColor={uiTheme.colors.white}
                    ios_backgroundColor={uiTheme.colors.elevatedHigh}
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
                <TouchableOpacity accessibilityRole="button"
                  accessibilityLabel="Your Contact Details"
                  accessibilityState={{ expanded: !!contactDetailsOpen }}
                  style={styles.contactHeader}
                  onPress={toggleContactDetails}
                  activeOpacity={0.8}
                >
                  <View style={styles.contactHeaderLeft}>
                    <Ionicons name="card-outline" size={18} color={uiTheme.colors.accent} />
                    <Text style={styles.contactHeaderTitle} numberOfLines={1}>Your Contact Details</Text>
                  </View>
                  <Ionicons
                    name={contactDetailsOpen ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={contactDetailsOpen ? uiTheme.colors.accent : uiTheme.colors.muted}
                  />
                </TouchableOpacity>

                {contactDetailsOpen && (
                  <View style={styles.contactBody}>
                    {/* Instagram Row */}
                    <View style={styles.contactRow}>
                      <Ionicons name="logo-instagram" size={18} color="#E1306C" style={styles.contactRowIcon} />
                      <Text style={styles.contactRowLabel} numberOfLines={1}>Instagram</Text>
                      <Switch
                        accessibilityLabel="Share Instagram"
                        value={form.contactDetails?.instagram?.enabled !== false}
                        onValueChange={v => updateField('contactDetails.instagram.enabled', v)}
                        trackColor={{ false: uiTheme.colors.elevatedHigh, true: uiTheme.colors.primary }}
                        thumbColor={uiTheme.colors.white}
                        ios_backgroundColor={uiTheme.colors.elevatedHigh}
                      />
                    </View>
                    <FocusInput
                      style={styles.contactInput}
                      placeholder="@yourhandle"
                      accessibilityLabel="Instagram handle"
                      autoCapitalize="none"
                      value={form.contactDetails?.instagram?.value || ''}
                      onChangeText={val => updateField('contactDetails.instagram.value', val)}
                    />
                    <View style={styles.handleStatRow}>
                      <Ionicons name="mail-outline" size={12} color={uiTheme.colors.muted} />
                      <Text style={styles.handleStatText}>
                        Sent to <Text style={[styles.handleStatCount, { color: uiTheme.colors.accent }]}>{form.handleSentStats?.instagram || 0}</Text> matches
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
                    <View style={[styles.contactRow, styles.contactRowSpaced]}>
                      <Ionicons name="logo-whatsapp" size={18} color="#25D366" style={styles.contactRowIcon} />
                      <Text style={styles.contactRowLabel} numberOfLines={1}>WhatsApp</Text>
                      <Switch
                        accessibilityLabel="Share WhatsApp"
                        value={form.contactDetails?.whatsapp?.enabled !== false}
                        onValueChange={v => updateField('contactDetails.whatsapp.enabled', v)}
                        trackColor={{ false: uiTheme.colors.elevatedHigh, true: uiTheme.colors.primary }}
                        thumbColor={uiTheme.colors.white}
                        ios_backgroundColor={uiTheme.colors.elevatedHigh}
                      />
                    </View>
                    <FocusInput
                      style={styles.contactInput}
                      placeholder="+1 555 000 0000"
                      accessibilityLabel="WhatsApp number"
                      keyboardType="phone-pad"
                      value={form.contactDetails?.whatsapp?.value || ''}
                      onChangeText={val => updateField('contactDetails.whatsapp.value', val)}
                    />
                    <View style={styles.handleStatRow}>
                      <Ionicons name="mail-outline" size={12} color={uiTheme.colors.muted} />
                      <Text style={styles.handleStatText}>
                        Sent to <Text style={[styles.handleStatCount, { color: uiTheme.colors.success }]}>{form.handleSentStats?.whatsapp || 0}</Text> matches
                      </Text>
                    </View>

                    <Text style={styles.helperNote}>
                      Toggle on the details you want the AI to share when a match asks for your contact.
                    </Text>

                    <View style={styles.subBoxDivider} />

                    {/* ─── Your Gender Selector ─── */}
                    <View style={styles.genderBlock}>
                      <Text style={styles.inputLabel}>Your gender</Text>
                      <View style={styles.genderSelector} accessibilityRole="radiogroup" accessibilityLabel="Your gender">
                        {GENDER_OPTIONS.map(g => {
                          const currentGender = (form.userGenderOverride || 'auto').toLowerCase();
                          const isSelected = currentGender === g.id;
                          return (
                            <TouchableOpacity accessibilityRole="button"
                              key={g.id}
                              accessibilityLabel={g.label}
                              accessibilityState={{ selected: isSelected }}
                              style={[styles.genderBtn, isSelected && styles.genderBtnActive]}
                              onPress={() => updateField('userGenderOverride', g.id)}
                              activeOpacity={0.8}
                            >
                              <Text style={[styles.genderBtnText, isSelected && styles.genderBtnTextActive]} numberOfLines={1}>
                                {g.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <Text style={styles.helperNote}>
                        Used for grammar in AI messages. Auto = detected from your profile. Set manually if Auto is wrong.
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
        )}

        {/* ════════════════════ CARD 2: SWIPING & SAFETY LIMITS ════════════════════ */}
        {SHOW_SWIPING_CONTROLS && (
        <View style={[styles.v2Card, openCards.swiping && styles.v2CardOpen]}>
          <TouchableOpacity accessibilityRole="button"
            style={styles.v2CardHeader}
            onPress={() => toggleCard('swiping')}
            activeOpacity={0.85}
          >
            <View style={styles.cardTitleWrap}>
              <Ionicons name="heart-outline" size={17} color={uiTheme.colors.primary} />
              <Text style={styles.v2CardTitle}>Swiping</Text>
            </View>
            <Ionicons
              name={openCards.swiping ? "chevron-up" : "chevron-down"}
              size={18}
              color={uiTheme.colors.muted}
            />
          </TouchableOpacity>

          {/* Collapsed Summary Chips */}
          {!openCards.swiping && (
            <View style={styles.collapsedRow}>
              <View style={styles.v2Chip}>
                <Ionicons name="flash" size={11} color={uiTheme.colors.primary} />
                <Text style={styles.v2ChipText}>{getSwipingSummary().likes}</Text>
              </View>
              <View style={styles.v2Chip}>
                <Ionicons name="time-outline" size={11} color={uiTheme.colors.info} />
                <Text style={styles.v2ChipText}>{getSwipingSummary().pacing}</Text>
              </View>
              <View style={styles.v2Chip}>
                <Text style={styles.v2ChipText}>{getSwipingSummary().age}</Text>
              </View>
            </View>
          )}

          {/* Expanded Body */}
          {openCards.swiping && (
            <View style={styles.v2CardBody}>
              <Text style={styles.fieldDesc}>Control swipe batches, cooldown pacing & profile filters:</Text>

              {/* Core Swiping Controls (Auto Swipe & Activity Speed) */}
              <View style={[styles.subBox, isSafetyOn && { borderColor: alpha(uiTheme.colors.primary, 0.2) }]}>
                {/* Auto Swipe Toggle */}
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.toggleTitle}>Auto Swipe</Text>
                    </View>
                    <Text style={styles.labelMuted}>
                      {isAutoSwipeOn
                        ? (isSafetyOn ? 'Safe automated swiping active' : 'Automatically swipe profiles on schedule')
                        : 'Swiping disabled — Auto Messaging active'}
                    </Text>
                  </View>
                  <Switch
                    value={isAutoSwipeOn}
                    onValueChange={v => {
                      if (v) {
                        updateFields({
                          autoSwipe: true,
                          likesPerCycle: form?.lastNonZeroLikes || 50,
                        });
                      } else {
                        const lastLikes = (form?.likesPerCycle ?? 0) > 0 ? form.likesPerCycle : (form?.lastNonZeroLikes || 50);
                        const updates = {
                          autoSwipe: false,
                          likesPerCycle: 0,
                          lastNonZeroLikes: lastLikes,
                        };
                        // Invariant: At least one automation mode must always be active.
                        // If Auto Messaging is currently off, turning off Auto Swipe MUST auto-enable Auto Messaging!
                        if (!isAutoMessagingOn) {
                          updates.autoMessage = true;
                          updates.messagesPerCycle = form?.lastNonZeroMessages || 50;
                        }
                        updateFields(updates);
                      }
                    }}
                    trackColor={{ false: uiTheme.colors.elevatedHigh, true: uiTheme.colors.primary }}
                    thumbColor={uiTheme.colors.white}
                    ios_backgroundColor={uiTheme.colors.elevatedHigh}
                  />
                </View>

                <View style={styles.subBoxDivider} />

                {/* Activity Speed Dropdown (V2 UI Parity) */}
                <V2Dropdown
                  label="Activity Speed"
                  disabled={isSafetyOn}
                  options={[
                    { value: 30, label: 'Every 30 min', desc: 'Active cadence (Safe limit)' },
                    { value: 60, label: 'Every Hour', desc: 'Balanced background pacing' },
                    { value: 120, label: 'Every 2 Hours', desc: 'Relaxed slow pacing' },
                  ]}
                  selectedValue={form.scheduleInterval ?? 30}
                  onSelect={val => updateField('scheduleInterval', val)}
                />

                {isSafetyOn && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                    <Ionicons name="lock-closed" size={11} color={uiTheme.colors.muted} style={{ marginRight: 5 }} />
                    <Text style={{ ...uiTheme.type.footnote, fontFamily: uiTheme.fonts.body, color: uiTheme.colors.muted, fontStyle: 'italic', flex: 1 }}>
                      Activity Speed is locked to safe defaults. Toggle Safety Mode OFF in Settings to customize pacing.
                    </Text>
                  </View>
                )}
              </View>

              {/* ─── Age Range Filter (V2 Desktop Parity) ─── */}
              <View style={styles.subBox}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.toggleTitle}>Age Range</Text>
                    <Text style={styles.labelMuted}>Filter profiles by age bracket</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.v2ValueBadge}>
                      <Text style={styles.v2ValueBadgeText}>
                        {form.ageFilter?.enabled
                          ? `${form.ageFilter?.min ?? 20}–${form.ageFilter?.max ?? 35}`
                          : '18–99 (Off)'}
                      </Text>
                    </View>
                    <Switch
                      value={form.ageFilter?.enabled === true}
                      onValueChange={v => updateField('ageFilter.enabled', v)}
                      trackColor={{ false: uiTheme.colors.elevatedHigh, true: uiTheme.colors.primary }}
                      thumbColor={uiTheme.colors.white}
                      ios_backgroundColor={uiTheme.colors.elevatedHigh}
                    />
                  </View>
                </View>

                {form.ageFilter?.enabled && (
                  <View style={{ marginTop: 12 }}>
                    {/* Dual-Thumb Range Slider (Desktop V2 100% Parity) */}
                    <MultiRangeSlider
                      min={18}
                      max={99}
                      minValue={form.ageFilter?.min ?? 20}
                      maxValue={form.ageFilter?.max ?? 35}
                      unit="yrs"
                      onValuesChange={(newMin, newMax) => {
                        updateField('ageFilter.min', newMin);
                        updateField('ageFilter.max', newMax);
                      }}
                    />

                    <Text style={[styles.inputLabel, { marginTop: 6, marginBottom: 6 }]}>Quick Brackets</Text>
                    <View style={styles.chipRow}>
                      {[
                        { min: 18, max: 25, label: '18–25' },
                        { min: 21, max: 30, label: '21–30' },
                        { min: 25, max: 35, label: '25–35' },
                        { min: 30, max: 45, label: '30–45' },
                        { min: 18, max: 99, label: 'All Ages' },
                      ].map(b => {
                        const isActive =
                          (form.ageFilter?.min ?? 20) === b.min &&
                          (form.ageFilter?.max ?? 35) === b.max;
                        return (
                          <TouchableOpacity accessibilityRole="button"
                            key={b.label}
                            style={[styles.chip, isActive && styles.chipActive]}
                            onPress={() => {
                              updateField('ageFilter.min', b.min);
                              updateField('ageFilter.max', b.max);
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                              {b.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>

              {/* ─── Distance Range Filter (V2 Desktop Parity) ─── */}
              <View style={styles.subBox}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.toggleTitle}>Distance Range</Text>
                    <Text style={styles.labelMuted}>Maximum location distance radius</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.v2ValueBadge}>
                      <Text style={styles.v2ValueBadgeText}>
                        {form.distanceFilter?.enabled
                          ? `Up to ${form.distanceFilter?.maxDistance ?? 50} km`
                          : 'No Limit (Off)'}
                      </Text>
                    </View>
                    <Switch
                      value={form.distanceFilter?.enabled === true}
                      onValueChange={v => updateField('distanceFilter.enabled', v)}
                      trackColor={{ false: uiTheme.colors.elevatedHigh, true: uiTheme.colors.primary }}
                      thumbColor={uiTheme.colors.white}
                      ios_backgroundColor={uiTheme.colors.elevatedHigh}
                    />
                  </View>
                </View>

                {form.distanceFilter?.enabled && (
                  <View style={{ marginTop: 12 }}>
                    {/* Interactive Touch Slider (Desktop V2 Parity) */}
                    <RangeSlider
                      min={2}
                      max={150}
                      value={form.distanceFilter?.maxDistance ?? 50}
                      unit="km"
                      prefix="Up to "
                      onValueChange={(val) => updateField('distanceFilter.maxDistance', val)}
                    />

                    <Text style={[styles.inputLabel, { marginTop: 6, marginBottom: 6 }]}>Radius Presets</Text>
                    <View style={styles.chipRow}>
                      {[
                        { dist: 10, label: '10 km' },
                        { dist: 25, label: '25 km' },
                        { dist: 50, label: '50 km' },
                        { dist: 100, label: '100 km' },
                        { dist: 150, label: '150 km' },
                      ].map(d => {
                        const isActive = (form.distanceFilter?.maxDistance ?? 50) === d.dist;
                        return (
                          <TouchableOpacity accessibilityRole="button"
                            key={d.label}
                            style={[styles.chip, isActive && styles.chipActive]}
                            onPress={() => updateField('distanceFilter.maxDistance', d.dist)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                              {d.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>

              {/* ─── Active Dating Location Capsule (Single Source of Truth in Settings) ─── */}
              {SHOW_LOCATION_FEATURE && (
              <View style={styles.swipingLocationCapsule}>
                <View style={styles.swipingLocationLeft}>
                  <View style={styles.swipingLocationTopRow}>
                    <Text style={styles.swipingLocationTitle}>Dating Location</Text>
                    <View style={[
                      styles.swipingLocationBadge,
                      form?.useDeviceLocation ? styles.swipingLocationBadgeGps : styles.swipingLocationBadgePassport
                    ]}>
                      <Ionicons
                        name={form?.useDeviceLocation ? "navigate" : "airplane"}
                        size={10}
                        color={form?.useDeviceLocation ? uiTheme.colors.success : uiTheme.colors.primary}
                      />
                      <Text style={[
                        styles.swipingLocationBadgeText,
                        form?.useDeviceLocation ? { color: uiTheme.colors.success } : { color: uiTheme.colors.primary }
                      ]}>
                        {form?.useDeviceLocation ? 'LIVE GPS' : 'PASSPORT'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.swipingLocationCityRow}>
                    <Text style={styles.swipingLocationCityText} numberOfLines={1}>
                      {CITY_PRESETS.find(p => (form?.locationCity || '').includes(p.short))?.flag || '📍'}{' '}
                      {form?.locationCity || 'New York, USA'}
                    </Text>
                    <Text style={styles.swipingLocationSub}>
                      {form?.useDeviceLocation
                        ? 'Matching near your physical phone location'
                        : 'Matching in selected passport destination'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity accessibilityRole="button"
                  style={styles.swipingLocationActionBtn}
                  onPress={() => {
                    if (onNavigateToSettings) {
                      onNavigateToSettings('location');
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.swipingLocationActionText}>Change</Text>
                  <Ionicons name="arrow-forward" size={12} color={uiTheme.colors.primary} />
                </TouchableOpacity>
              </View>
              )}
            </View>
          )}
        </View>
        )}

        {/* ════════════════════ CARD 3: MESSAGING (V2 DESKTOP PARITY) ════════════════════ */}
        {SHOW_MESSAGING_CONTROLS && (
        <View style={[styles.v2Card, openCards.messaging && styles.v2CardOpen]}>
          <TouchableOpacity accessibilityRole="button"
            style={styles.v2CardHeader}
            onPress={() => toggleCard('messaging')}
            activeOpacity={0.85}
          >
            <View style={styles.cardTitleWrap}>
              <Ionicons name="chatbubbles-outline" size={17} color={uiTheme.colors.accent} />
              <Text style={styles.v2CardTitle}>Messaging</Text>
            </View>
            <Ionicons
              name={openCards.messaging ? "chevron-up" : "chevron-down"}
              size={18}
              color={uiTheme.colors.muted}
            />
          </TouchableOpacity>

          {/* Collapsed Summary Chips */}
          {!openCards.messaging && (
            <View style={styles.collapsedRow}>
              <View style={styles.v2Chip}>
                <Ionicons name="chatbubble" size={11} color={isAutoMessagingOn ? uiTheme.colors.accent : uiTheme.colors.muted} />
                <Text style={styles.v2ChipText}>{getMessagingSummary().messaging}</Text>
              </View>
              <View style={styles.v2Chip}>
                <Ionicons name="sparkles" size={11} color={uiTheme.colors.accent} />
                <Text style={styles.v2ChipText}>{getMessagingSummary().intention}</Text>
              </View>
              <View style={styles.v2Chip}>
                <Ionicons name="color-wand" size={11} color={uiTheme.colors.success} />
                <Text style={styles.v2ChipText}>{getMessagingSummary().tone}</Text>
              </View>
              {SHOW_DEFAULT_LANGUAGE && (
                <View style={styles.v2Chip}>
                  <Ionicons name="globe-outline" size={11} color={uiTheme.colors.warning} />
                  <Text style={styles.v2ChipText}>{getMessagingSummary().lang}</Text>
                </View>
              )}
              <View style={styles.v2Chip}>
                <Text style={styles.v2ChipText}>{getMessagingSummary().emojis}</Text>
              </View>
              {getMessagingSummary().consecutive && (
                <View style={styles.v2Chip}>
                  <Text style={styles.v2ChipText}>Multi-text</Text>
                </View>
              )}
            </View>
          )}

          {/* Expanded Body */}
          {openCards.messaging && (
            <View style={styles.v2CardBody}>
              <Text style={styles.fieldDesc}>Configure conversation style, intentions & priority balancing:</Text>

              {/* Core Messaging Controls (Auto Messaging) */}
              <View style={[styles.subBox, isSafetyOn && { borderColor: alpha(uiTheme.colors.primary, 0.2) }]}>
                {/* Auto Messaging Toggle */}
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.toggleTitle}>Auto Messaging</Text>
                    </View>
                    <Text style={styles.labelMuted}>
                      {isAutoMessagingOn
                        ? (isSafetyOn ? 'Safe automated chat & openers active' : 'Automatically chat with matches & send openers')
                        : 'Messaging disabled — Auto Swipe active'}
                    </Text>
                  </View>
                  <Switch
                    value={isAutoMessagingOn}
                    onValueChange={v => {
                      if (v) {
                        updateFields({
                          autoMessage: true,
                          messagesPerCycle: form?.lastNonZeroMessages || 50,
                        });
                      } else {
                        const lastMsgs = (form?.messagesPerCycle ?? 0) > 0 ? form.messagesPerCycle : (form?.lastNonZeroMessages || 50);
                        const updates = {
                          autoMessage: false,
                          messagesPerCycle: 0,
                          lastNonZeroMessages: lastMsgs,
                        };
                        // Invariant: At least one automation mode must always be active.
                        // If Auto Swipe is currently off, turning off Auto Messaging MUST auto-enable Auto Swipe!
                        if (!isAutoSwipeOn) {
                          updates.autoSwipe = true;
                          updates.likesPerCycle = form?.lastNonZeroLikes || 50;
                        }
                        updateFields(updates);
                      }
                    }}
                    trackColor={{ false: uiTheme.colors.elevatedHigh, true: uiTheme.colors.primary }}
                    thumbColor={uiTheme.colors.white}
                    ios_backgroundColor={uiTheme.colors.elevatedHigh}
                  />
                </View>
              </View>

              {/* ─── Core Toggles (Smart Reactions, Use Emojis, Consecutive Messages) ─── */}
              <View style={styles.subBox}>
                {/* Smart Reactions */}
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.toggleTitle}>Smart Reactions</Text>
                      <TouchableOpacity accessibilityRole="button"
                        onPress={() => setTooltipModal({
                          title: 'Smart Reactions',
                          lines: [
                            '① AI randomly likes (❤️) messages from matches',
                            '② Pushes your chat to the top of their inbox',
                            '③ Increases the chance they reply to you'
                          ]
                        })}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="information-circle-outline" size={14} color={uiTheme.colors.muted} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.labelMuted}>AI randomly likes (❤️) received messages to push chat to top</Text>
                  </View>
                  <Switch
                    value={(form.randomHearts ?? form.smartReactionsEnabled) === true}
                    onValueChange={v => {
                      updateField('randomHearts', v);
                      updateField('smartReactionsEnabled', v);
                    }}
                    trackColor={{ false: uiTheme.colors.elevatedHigh, true: uiTheme.colors.primary }}
                    thumbColor={uiTheme.colors.white}
                    ios_backgroundColor={uiTheme.colors.elevatedHigh}
                  />
                </View>

                <View style={styles.subBoxDivider} />

                {/* Use Emoji's */}
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.toggleTitle}>Use Emoji's</Text>
                    <Text style={styles.labelMuted}>Include expressive emojis in generated AI responses</Text>
                  </View>
                  <Switch
                    value={form.useEmojis !== false}
                    onValueChange={v => updateField('useEmojis', v)}
                    trackColor={{ false: uiTheme.colors.elevatedHigh, true: uiTheme.colors.primary }}
                    thumbColor={uiTheme.colors.white}
                    ios_backgroundColor={uiTheme.colors.elevatedHigh}
                  />
                </View>

                <View style={styles.subBoxDivider} />

                {/* Consecutive Messages (Double Texting) */}
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.toggleTitle}>Consecutive Messages</Text>
                      <TouchableOpacity accessibilityRole="button"
                        onPress={() => setTooltipModal({
                          title: 'Consecutive Messages',
                          lines: [
                            '① Match sends multiple messages in a row',
                            '② AI mirrors their energy with 2–3 replies back',
                            '③ Each part uses 1 message credit'
                          ]
                        })}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="information-circle-outline" size={14} color={uiTheme.colors.muted} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.labelMuted}>AI mirrors match energy with 2–3 message replies when they text in bursts</Text>
                  </View>
                  <Switch
                    value={form.consecutiveMessagesEnabled === true}
                    onValueChange={v => updateField('consecutiveMessagesEnabled', v)}
                    trackColor={{ false: uiTheme.colors.elevatedHigh, true: uiTheme.colors.primary }}
                    thumbColor={uiTheme.colors.white}
                    ios_backgroundColor={uiTheme.colors.elevatedHigh}
                  />
                </View>
              </View>

              {/* ─── Your Intentions Dropdown (V2 UI Parity) ─── */}
              <View style={styles.subBox}>
                <V2Dropdown
                  label="Your Intentions"
                  options={INTENTIONS_OPTIONS.map(item => ({
                    id: item.id,
                    value: item.id,
                    label: item.label,
                  }))}
                  selectedValue={form.intentions || 'short_term'}
                  onSelect={val => updateField('intentions', val)}
                />
              </View>

              {/* ─── Conversation Tone Dropdown (V2 UI Parity) ─── */}
              <View style={styles.subBox}>
                <V2Dropdown
                  label="Conversation Tone"
                  options={TONE_OPTIONS.map(t => ({
                    id: t.toLowerCase(),
                    value: t.toLowerCase(),
                    label: t,
                  }))}
                  selectedValue={(form.tone || form.chattingStyle || 'freestyle').toLowerCase()}
                  onSelect={val => {
                    const titleCased = val.charAt(0).toUpperCase() + val.slice(1);
                    updateField('tone', titleCased);
                    updateField('chattingStyle', val);
                  }}
                />
              </View>

              {/* ─── Default Language Dropdown (V2 UI Parity) ─── */}
              {SHOW_DEFAULT_LANGUAGE && (
                <View style={styles.subBox}>
                  <V2Dropdown
                    label="Default Language"
                    sublabel="(Editable per match)"
                    options={LANGUAGE_OPTIONS.map(lang => ({
                      id: lang.code,
                      value: lang.code,
                      label: lang.label,
                      flag: lang.flag,
                    }))}
                    selectedValue={form.conversationLanguage || 'en'}
                    onSelect={val => updateField('conversationLanguage', val)}
                  />
                </View>
              )}
            </View>
          )}
        </View>
        )}

        {/* ════════════════════ CARD 4: YOUR CHAT STYLE & AI TRAINING (V2 DESKTOP PARITY) ════════════════════ */}
        {SHOW_CHAT_STYLE_TRAINING && (
        <View style={[styles.v2Card, openCards.style && styles.v2CardOpen]}>
          <TouchableOpacity accessibilityRole="button"
            style={styles.v2CardHeader}
            onPress={() => toggleCard('style')}
            activeOpacity={0.85}
          >
            <View style={styles.cardTitleWrap}>
              <Ionicons name="sparkles-outline" size={17} color={uiTheme.colors.info} />
              <Text style={styles.v2CardTitle}>Your Chat Style</Text>
            </View>
            <Ionicons
              name={openCards.style ? "chevron-up" : "chevron-down"}
              size={18}
              color={uiTheme.colors.muted}
            />
          </TouchableOpacity>

          {/* Collapsed Summary Chips */}
          {!openCards.style && (
            <View style={styles.collapsedRow}>
              {getStyleSummary().map((item, idx) => (
                <View key={idx} style={[styles.v2Chip, item.full && { borderColor: alpha(uiTheme.colors.info, 0.4) }]}>
                  <Ionicons name="sparkles" size={11} color={uiTheme.colors.info} />
                  <Text style={[styles.v2ChipText, item.full && { color: uiTheme.colors.text }]}>{item.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Expanded Body */}
          {openCards.style && (
            <View style={styles.v2CardBody}>
              {/* ─── SCREEN 1: INTRO / OVERVIEW ─── */}
              {styleView === 'intro' && (() => {
                const profiles = form?.chatStyleProfiles || {};
                const legacy = form?.chatStyleProfile;
                if (legacy?.trained && !profiles[legacy.trainingLanguage || 'en']) {
                  profiles[legacy.trainingLanguage || 'en'] = legacy;
                }
                const activeProfile = profiles[trainingLang];
                const isTrained = !!activeProfile?.trained;
                const isFull = isTrained && !activeProfile?.partial;
                const currentLangObj = LANGUAGE_OPTIONS.find(l => l.code === trainingLang) || { label: 'English', flag: '🇺🇸' };
                const trainedCodes = Object.keys(profiles).filter(k => profiles[k]?.trained);

                const maxProfiles = form?.remoteStyleTrainingConfig?.maxProfiles ?? 3;
                const atCap = !isTrained && trainedCodes.length >= maxProfiles;

                return (
                  <View style={styles.cstIntroContainer}>
                    <View style={styles.cstIntroIconWrap}>
                      <Ionicons name="chatbubbles" size={24} color={uiTheme.colors.info} />
                    </View>

                    <Text style={styles.cstIntroTitle}>
                      {atCap
                        ? 'Profile Limit Reached'
                        : isFull
                          ? `Retrain for ${currentLangObj.label}`
                          : isTrained
                            ? `Continue training ${currentLangObj.label}`
                            : 'Train Your Chat Style'}
                    </Text>

                    <Text style={styles.cstIntroDesc}>
                      {atCap
                        ? `You have ${trainedCodes.length} trained profiles (the maximum). Delete one from your existing profiles to train a new language.`
                        : isFull
                          ? `You have a complete style profile for ${currentLangObj.label}. Start a new session to update your texting rhythm.`
                          : isTrained
                            ? `Your ${currentLangObj.label} profile has ${activeProfile.messageCount || 0} messages — 12 messages gives the highest AI accuracy.`
                            : 'Reply to a few messages from a practice match. The AI learns how you write so when it messages your matches, it uses your tone, your words and your rhythm.'}
                    </Text>

                    {/* Trained Languages Bar */}
                    {trainedCodes.length > 0 && (
                      <View style={styles.cstTrainedBar}>
                        <Text style={styles.cstTrainedBarLabel}>Trained Languages ({trainedCodes.length}/{maxProfiles}):</Text>
                        <View style={styles.cstTrainedChipsRow}>
                          {trainedCodes.map(code => {
                            const p = profiles[code];
                            const lObj = LANGUAGE_OPTIONS.find(l => l.code === code) || { label: code, flag: '🌐' };
                            const isActive = code === trainingLang;
                            return (
                              <TouchableOpacity accessibilityRole="button"
                                key={code}
                                style={[styles.cstTrainedPill, isActive && styles.cstTrainedPillActive]}
                                onPress={() => {
                                  setViewingLang(code);
                                  setStyleView('insights');
                                }}
                                activeOpacity={0.8}
                              >
                                <Text style={[styles.cstTrainedPillText, isActive && styles.cstTrainedPillTextActive]}>
                                  {p.partial ? `${lObj.flag} ${lObj.label} ${p.messageCount || 0}/12` : `✓ ${lObj.flag} ${lObj.label}`}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Training Language Dropdown */}
                    <View style={{ marginTop: 12 }}>
                      <V2Dropdown
                        label="Training language"
                        options={LANGUAGE_OPTIONS.map(l => ({
                          id: l.code,
                          value: l.code,
                          label: l.label,
                          flag: l.flag,
                        }))}
                        selectedValue={trainingLang}
                        onSelect={val => setTrainingLang(val)}
                      />
                    </View>

                    {/* Start / Continue Button */}
                    <TouchableOpacity accessibilityRole="button"
                      style={[styles.cstStartBtn, atCap && { opacity: 0.5, backgroundColor: uiTheme.colors.elevatedHigh }]}
                      onPress={() => !atCap && startTrainingSession(trainingLang, isFull)}
                      disabled={atCap}
                      activeOpacity={0.85}
                    >
                      <Ionicons name={atCap ? "alert-circle" : "sparkles"} size={15} color={uiTheme.colors.onPrimary} />
                      <Text style={styles.cstStartBtnText}>
                        {atCap
                          ? `Profile Limit Reached (Max ${maxProfiles})`
                          : isFull
                            ? `Retrain ${currentLangObj.label}`
                            : isTrained
                              ? `Continue Training ${currentLangObj.label}`
                              : `Start Training (${currentLangObj.label})`}
                      </Text>
                    </TouchableOpacity>

                    {/* View Trained Style Button */}
                    {isTrained && (
                      <TouchableOpacity accessibilityRole="button"
                        style={styles.cstViewTrainedBtn}
                        onPress={() => {
                          setViewingLang(trainingLang);
                          setStyleView('insights');
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.cstViewTrainedBtnText}>View trained style profile</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })()}

              {/* ─── SCREEN 2: SIMULATOR CHAT (V2 DESKTOP PARITY) ─── */}
              {styleView === 'chat' && (() => {
                const validCount = chatMessages.filter(m => m.sender === 'user' && !m.garbage).length;
                const progressPct = Math.min((validCount / 12) * 100, 100);
                const currentLangObj = LANGUAGE_OPTIONS.find(l => l.code === trainingLang) || { label: 'English', flag: '🇺🇸' };
                const persona = getPersonaForLang(trainingLang);
                const profiles = form?.chatStyleProfiles || {};
                const trainedCodes = Object.keys(profiles).filter(k => profiles[k]?.trained);

                return (
                  <View style={styles.cstSimContainer}>
                    {/* Top Simulator Header */}
                    <View style={styles.cstSimTopBar}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={styles.simAvatarWrapper}>
                          <View style={styles.simAvatar}>
                            <Text style={{ ...uiTheme.type.footnote, fontFamily: uiTheme.fonts.strong, color: uiTheme.colors.onPrimary }}>
                              {persona.name.charAt(0)}
                            </Text>
                          </View>
                          <View style={styles.simAvatarOnlineDot} />
                        </View>
                        <View>
                          <Text style={styles.simMatchName}>{persona.name}</Text>
                          <Text style={{ ...uiTheme.type.footnote, fontFamily: uiTheme.fonts.label, color: uiTheme.colors.success }}>Online now</Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 60, height: 4, backgroundColor: uiTheme.colors.divider, borderRadius: 2, overflow: 'hidden' }}>
                          <View style={{ width: `${progressPct}%`, height: '100%', backgroundColor: uiTheme.colors.primary, borderRadius: 2 }} />
                        </View>
                        <Text style={{ ...uiTheme.type.footnote, fontFamily: uiTheme.fonts.strong, color: uiTheme.colors.muted }}>{validCount} / 12</Text>
                        <TouchableOpacity accessibilityRole="button"
                          style={styles.cstRestartBtn}
                          onPress={restartTrainingSession}
                          activeOpacity={0.8}
                          accessibilityLabel="Restart"
                        >
                          <Ionicons name="refresh" size={13} color={uiTheme.colors.muted} />
                        </TouchableOpacity>
                        <TouchableOpacity accessibilityRole="button"
                          style={styles.cstCancelBtn}
                          onPress={() => setStyleView('intro')}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="close" size={15} color={uiTheme.colors.muted} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Messages Container */}
                    <ScrollView
                      style={styles.cstMessagesScroll}
                      contentContainerStyle={{ gap: 10, paddingVertical: 8 }}
                      showsVerticalScrollIndicator={false}
                    >
                      {/* Date Separator */}
                      <View style={styles.simDateSeparator}>
                        <Text style={styles.simDateSeparatorText}>TODAY</Text>
                      </View>

                      {chatMessages.map(msg => {
                        if (msg.sender === 'system') {
                          return (
                            <View key={msg.id} style={styles.simSystemHint}>
                              <Ionicons name="information-circle-outline" size={13} color={uiTheme.colors.warning} />
                              <Text style={styles.simSystemHintText}>{msg.text}</Text>
                            </View>
                          );
                        }
                        if (msg.sender === 'match') {
                          return (
                            <View key={msg.id} style={styles.simMatchRow}>
                              <View style={styles.simMatchAvatarTiny}>
                                <Text style={{ fontFamily: uiTheme.fonts.heavy, color: uiTheme.colors.onPrimary, fontSize: 10, fontWeight: 'normal' }}>
                                  {persona.name.charAt(0)}
                                </Text>
                              </View>
                              <View style={[styles.simBubble, styles.simBubbleMatch]}>
                                <Text style={styles.simBubbleTextMatch}>{msg.text}</Text>
                              </View>
                            </View>
                          );
                        }
                        return (
                          <View
                            key={msg.id}
                            style={[
                              styles.simBubble,
                              styles.simBubbleUser,
                              msg.garbage && { backgroundColor: alpha(uiTheme.colors.error, 0.2), borderWidth: 1, borderColor: alpha(uiTheme.colors.error, 0.4) }
                            ]}
                          >
                            <Text style={styles.simBubbleTextUser}>{msg.text}</Text>
                          </View>
                        );
                      })}
                      {calibrating && (
                        <View style={styles.simMatchRow}>
                          <View style={styles.simMatchAvatarTiny}>
                            <Text style={{ fontFamily: uiTheme.fonts.heavy, color: uiTheme.colors.onPrimary, fontSize: 10, fontWeight: 'normal' }}>
                              {persona.name.charAt(0)}
                            </Text>
                          </View>
                          <View style={[styles.simBubble, styles.simBubbleMatch]}>
                            <Text style={{ ...uiTheme.type.footnote, fontFamily: uiTheme.fonts.body, color: uiTheme.colors.muted, fontStyle: 'italic' }}>
                              {persona.name} is typing…
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Desktop V2 Finish Banner */}
                      {sessionCompleted && (
                        <View style={styles.cstFinishBanner}>
                          <Text style={{ fontFamily: uiTheme.fonts.body, fontSize: 22, textAlign: 'center', marginBottom: 4 }}>🎉</Text>
                          <Text style={styles.cstFinishTitle}>Training complete!</Text>
                          <Text style={styles.cstFinishSub}>
                            Your style has been captured. Tap below to see what the AI learned.
                          </Text>
                          <TouchableOpacity accessibilityRole="button"
                            style={styles.cstFinishBtn}
                            onPress={finishAndSaveSession}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.cstFinishBtnText}>See Results</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </ScrollView>

                    {/* Footer Action Row with Globe Pill */}
                    <View style={styles.simActionRow}>
                      {validCount > 0 && !sessionCompleted && (
                        <TouchableOpacity accessibilityRole="button"
                          style={[
                            styles.cstSaveInlinePill,
                            inlineSaved && { borderColor: uiTheme.colors.success, backgroundColor: alpha(uiTheme.colors.success, 0.12) }
                          ]}
                          onPress={saveStyleInline}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.cstSaveInlinePillText, inlineSaved && { color: uiTheme.colors.success }]}>
                            {inlineSaved ? '✓ Saved' : 'Save style'}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <View style={{ flex: 1 }} />
                      {trainedCodes.length > 0 && (
                        <TouchableOpacity accessibilityRole="button"
                          style={styles.cstProfilesBtn}
                          onPress={() => setSimLangModalOpen(true)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="person-circle-outline" size={13} color={uiTheme.colors.info} />
                          <Text style={styles.cstProfilesBtnText}>Profiles {trainedCodes.length}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity accessibilityRole="button"
                        style={styles.simLangPill}
                        onPress={() => setSimLangModalOpen(true)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="globe-outline" size={12} color={uiTheme.colors.primary} />
                        <Text style={styles.simLangPillText}>{currentLangObj.label}</Text>
                        <Ionicons name="chevron-down" size={12} color={uiTheme.colors.primary} />
                      </TouchableOpacity>
                    </View>

                    {/* Simulator Language Selection Modal */}
                    <Modal
                      visible={simLangModalOpen}
                      transparent
                      animationType="fade"
                      onRequestClose={() => setSimLangModalOpen(false)}
                    >
                      <TouchableOpacity accessibilityRole="button"
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={() => setSimLangModalOpen(false)}
                      >
                        <View style={styles.simLangModalContent} onStartShouldSetResponder={() => true}>
                          <View style={styles.simLangModalHeader}>
                            <Text style={styles.simLangModalTitle}>Training Language</Text>
                            <TouchableOpacity accessibilityRole="button"
                              onPress={() => setSimLangModalOpen(false)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="close" size={18} color={uiTheme.colors.muted} />
                            </TouchableOpacity>
                          </View>

                          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                            {LANGUAGE_OPTIONS.map(lang => {
                              const isSelected = lang.code === trainingLang;
                              const isTrained = !!form?.chatStyleProfiles?.[lang.code]?.trained;
                              const isPartial = !!form?.chatStyleProfiles?.[lang.code]?.partial;
                              const count = form?.chatStyleProfiles?.[lang.code]?.messageCount || 0;

                              return (
                                <TouchableOpacity accessibilityRole="button"
                                  key={lang.code}
                                  style={[
                                    styles.simLangModalOption,
                                    isSelected && styles.simLangModalOptionSelected
                                  ]}
                                  onPress={() => handleSwitchSimLanguage(lang.code)}
                                  activeOpacity={0.7}
                                >
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <Text style={{ fontFamily: uiTheme.fonts.body, fontSize: 18 }}>{lang.flag}</Text>
                                    <View>
                                      <Text style={[styles.simLangModalOptionText, isSelected && { fontFamily: uiTheme.fonts.heavy, color: uiTheme.colors.primary, fontWeight: 'normal' }]}>
                                        {lang.label}
                                      </Text>
                                      {isTrained && (
                                        <Text style={{ fontFamily: uiTheme.fonts.label, color: isPartial ? uiTheme.colors.warning : uiTheme.colors.success, fontSize: 10, fontWeight: 'normal' }}>
                                          {isPartial ? `Partial session (${count}/12)` : '✓ Style trained'}
                                        </Text>
                                      )}
                                    </View>
                                  </View>

                                  {isSelected && (
                                    <Ionicons name="checkmark-circle" size={18} color={uiTheme.colors.primary} />
                                  )}
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>
                      </TouchableOpacity>
                    </Modal>

                    {/* Practice Input Bar */}
                    <View style={{ marginTop: 4 }}>
                      <View style={styles.simInputRow}>
                        <TextInput
                          style={[
                            styles.simTextInput,
                            inputShaking && styles.simTextInputShaking,
                            sessionCompleted && { opacity: 0.5 }
                          ]}
                          placeholder={sessionCompleted ? "Training complete" : "Type your reply..."}
                          placeholderTextColor={uiTheme.colors.muted}
                          value={inputPracticeMsg}
                          onChangeText={text => {
                            setInputPracticeMsg(text);
                            if (inputWarning) setInputWarning('');
                            if (inputShaking) setInputShaking(false);
                          }}
                          onSubmitEditing={sendPracticeMessage}
                          editable={!sessionCompleted}
                        />
                        <TouchableOpacity accessibilityRole="button"
                          style={[styles.simSendBtn, sessionCompleted && { opacity: 0.4 }]}
                          onPress={sendPracticeMessage}
                          activeOpacity={0.8}
                          disabled={sessionCompleted}
                        >
                          <Ionicons name="arrow-forward" size={16} color={uiTheme.colors.onPrimary} />
                        </TouchableOpacity>
                      </View>

                      {/* Desktop V2 Bottom Orange Warning Message */}
                      {!!inputWarning && (
                        <Text style={styles.simInputWarningText}>{inputWarning}</Text>
                      )}
                    </View>
                  </View>
                );
              })()}

              {/* ─── SCREEN 3: TRAINED STYLE INSIGHTS & COMPLETION (V2 DESKTOP PARITY) ─── */}
              {styleView === 'insights' && (() => {
                const profiles = form?.chatStyleProfiles || {};
                const profile = profiles[viewingLang] || form?.chatStyleProfile || {};
                const langObj = LANGUAGE_OPTIONS.find(l => l.code === viewingLang) || { label: 'English', flag: '🇺🇸' };
                const isPartial = !!profile.partial;
                const hasSavedChat = (profile.savedMessages && profile.savedMessages.length > 0) || (chatMessages.length > 1);

                return (
                  <View style={styles.cstInsightsContainer}>
                    <View style={styles.cstInsightsHeader}>
                      <View style={[styles.cstBadgeSuccess, isPartial && { backgroundColor: alpha(uiTheme.colors.warning, 0.15), borderColor: alpha(uiTheme.colors.warning, 0.3) }]}>
                        <Ionicons
                          name={isPartial ? "time-outline" : "checkmark-circle"}
                          size={14}
                          color={isPartial ? uiTheme.colors.warning : uiTheme.colors.success}
                        />
                        <Text style={[styles.cstBadgeSuccessText, isPartial && { color: uiTheme.colors.warning }]}>
                          {isPartial ? 'Partial Style Saved' : 'Style Captured'}
                        </Text>
                      </View>
                      <Text style={styles.cstInsightsTitle}>{langObj.flag} {langObj.label} Style Profile</Text>
                      <Text style={styles.cstInsightsSub}>
                        {isPartial
                          ? `${profile.messageCount || 0} of 12 messages trained · more training improves accuracy.`
                          : `Trained on ${profile.messageCount || 12} messages. Your AI Wingman writes in this style in ${langObj.label}.`}
                      </Text>
                    </View>

                    {/* Trait Chips Bar (Desktop V2 .cst-traits) */}
                    <View style={styles.cstTraitsRow}>
                      <View style={styles.cstTraitChip}>
                        <Text style={styles.cstTraitChipText}>
                          {profile.aiSummary?.lengthTrait || (profile.aiSummary?.avgWords <= 6 ? 'Short messages' : (profile.aiSummary?.avgWords >= 14 ? 'Detailed messages' : 'Medium messages'))}
                        </Text>
                      </View>
                      <View style={styles.cstTraitChip}>
                        <Text style={styles.cstTraitChipText}>
                          {profile.aiSummary?.emojiTrait || (profile.aiSummary?.emojiPct === 0 ? 'No emoji' : (profile.aiSummary?.emojiPct > 45 ? 'Heavy emoji' : 'Light emoji'))}
                        </Text>
                      </View>
                      <View style={styles.cstTraitChip}>
                        <Text style={styles.cstTraitChipText}>
                          {profile.aiSummary?.toneTrait || (profile.aiSummary?.isLowercase ? 'Playful & casual' : 'Casual tone')}
                        </Text>
                      </View>
                      <View style={styles.cstTraitChip}>
                        <Text style={styles.cstTraitChipText}>
                          {profile.aiSummary?.followUpTrait || 'Natural flow'}
                        </Text>
                      </View>
                    </View>

                    {/* What the AI Noticed Summary Box (Desktop V2 .cst-ai-summary-wrap) */}
                    {profile.aiSummary?.whatAiNoticed && (
                      <View style={styles.cstAiSummaryWrap}>
                        <Text style={styles.cstAiSummaryLabel}>What the AI noticed</Text>
                        <Text style={styles.cstAiSummaryText}>{profile.aiSummary.whatAiNoticed}</Text>
                      </View>
                    )}

                    {/* Metric Cards Breakdown */}
                    <View style={styles.cstMetricGrid}>
                      <View style={styles.cstMetricCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="speedometer-outline" size={14} color={uiTheme.colors.primary} />
                          <Text style={styles.cstMetricTitle}>Texting Tempo & Length</Text>
                        </View>
                        <Text style={styles.cstMetricValue}>
                          {profile.aiSummary?.tempoDesc || 'Balanced & Natural (avg 7–12 words)'}
                        </Text>
                      </View>

                      <View style={styles.cstMetricCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="happy-outline" size={14} color={uiTheme.colors.accent} />
                          <Text style={styles.cstMetricTitle}>Emoji Placement</Text>
                        </View>
                        <Text style={styles.cstMetricValue}>
                          {profile.aiSummary?.emojiDesc || 'Expressive contextual placement (~30%)'}
                        </Text>
                      </View>

                      <View style={styles.cstMetricCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="text-outline" size={14} color={uiTheme.colors.info} />
                          <Text style={styles.cstMetricTitle}>Punctuation & Flow</Text>
                        </View>
                        <Text style={styles.cstMetricValue}>
                          {profile.aiSummary?.punctuationDesc || 'Modern lowercase casual rhythm'}
                        </Text>
                      </View>

                      <View style={styles.cstMetricCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="flash-outline" size={14} color={uiTheme.colors.success} />
                          <Text style={styles.cstMetricTitle}>AI Mirroring Status</Text>
                        </View>
                        <Text style={[styles.cstMetricValue, { fontFamily: uiTheme.fonts.strong, color: uiTheme.colors.success, fontWeight: 'normal' }]}>Active in Live Chats</Text>
                      </View>
                    </View>

                    {/* Action Buttons (100% Desktop V2 Complete Actions) */}
                    <View style={{ marginTop: 14, gap: 8 }}>
                      <TouchableOpacity accessibilityRole="button"
                        style={styles.cstStartBtn}
                        onPress={() => startTrainingSession(viewingLang, !isPartial)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="refresh" size={14} color={uiTheme.colors.onPrimary} />
                        <Text style={styles.cstStartBtnText}>
                          {isPartial ? `Continue Training ${langObj.label}` : `Retrain ${langObj.label} Style`}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity accessibilityRole="button"
                        style={styles.cstTrainAnotherBtn}
                        onPress={trainAnotherLanguage}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add" size={15} color={uiTheme.colors.onPrimary} />
                        <Text style={styles.cstTrainAnotherBtnText}>+ Train Another Language</Text>
                      </TouchableOpacity>

                      {hasSavedChat && (
                        <TouchableOpacity accessibilityRole="button"
                          style={styles.cstSecondaryBtn}
                          onPress={() => setStyleView('replay')}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="chatbox-ellipses-outline" size={14} color={uiTheme.colors.text} />
                          <Text style={styles.cstSecondaryBtnText}>View training chat</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity accessibilityRole="button"
                        style={styles.cstSecondaryBtn}
                        onPress={() => setStyleView('intro')}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.cstSecondaryBtnText}>Back to Overview</Text>
                      </TouchableOpacity>

                      <TouchableOpacity accessibilityRole="button"
                        style={styles.cstDeleteBtn}
                        onPress={() => deleteProfile(viewingLang)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="trash-outline" size={13} color={uiTheme.colors.error} />
                        <Text style={styles.cstDeleteBtnText}>Delete {langObj.label} Profile</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })()}

              {/* ─── SCREEN 4: CHAT REPLAY (DESKTOP V2 _renderChatReplay PARITY) ─── */}
              {styleView === 'replay' && (() => {
                const profiles = form?.chatStyleProfiles || {};
                const profile = profiles[viewingLang] || form?.chatStyleProfile || {};
                const langObj = LANGUAGE_OPTIONS.find(l => l.code === viewingLang) || { label: 'English', flag: '🇺🇸' };
                const replayMsgs = (profile.savedMessages && profile.savedMessages.length > 0) ? profile.savedMessages : chatMessages;

                return (
                  <View style={styles.cstSimContainer}>
                    <View style={styles.cstSimTopBar}>
                      <TouchableOpacity accessibilityRole="button"
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        onPress={() => setStyleView('insights')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="arrow-back" size={16} color={uiTheme.colors.info} />
                        <Text style={{ ...uiTheme.type.footnote, fontFamily: uiTheme.fonts.strong, color: uiTheme.colors.info }}>Back</Text>
                      </TouchableOpacity>
                      <Text style={styles.simMatchName}>{langObj.flag} Training Transcript</Text>
                      <View style={{ width: 40 }} />
                    </View>

                    <ScrollView
                      style={[styles.cstMessagesScroll, { maxHeight: 300, minHeight: 200 }]}
                      contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
                      showsVerticalScrollIndicator={false}
                    >
                      {replayMsgs.map(msg => (
                        <View
                          key={msg.id}
                          style={[styles.simBubble, msg.sender === 'user' ? styles.simBubbleUser : styles.simBubbleMatch]}
                        >
                          <Text style={[styles.simBubbleText, msg.sender === 'user' && { color: uiTheme.colors.onPrimary }]}>
                            {msg.text}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                );
              })()}

              {/* ─── SCREEN 5: LOW QUALITY NOTIFICATION (DESKTOP V2 _renderLowQualityScreen PARITY) ─── */}
              {styleView === 'lowQuality' && (() => {
                const langObj = LANGUAGE_OPTIONS.find(l => l.code === trainingLang) || { label: 'English', flag: '🇺🇸' };
                return (
                  <View style={styles.cstInsightsContainer}>
                    <View style={styles.cstInsightsHeader}>
                      <View style={[styles.cstBadgeSuccess, { backgroundColor: alpha(uiTheme.colors.error, 0.15), borderColor: alpha(uiTheme.colors.error, 0.3) }]}>
                        <Ionicons name="warning-outline" size={14} color={uiTheme.colors.error} />
                        <Text style={[styles.cstBadgeSuccessText, { color: uiTheme.colors.error }]}>Replies Too Short</Text>
                      </View>
                      <Text style={styles.cstInsightsTitle}>Replies too short to learn from</Text>
                      <Text style={styles.cstInsightsSub}>
                        The AI needs real sentences to pick up your style. Single words or random characters don't give it enough to work with. Try again and reply the way you'd actually text someone.
                      </Text>
                    </View>

                    <TouchableOpacity accessibilityRole="button"
                      style={styles.cstStartBtn}
                      onPress={() => startTrainingSession(trainingLang, true)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="refresh" size={14} color={uiTheme.colors.onPrimary} />
                      <Text style={styles.cstStartBtnText}>Try Again ({langObj.label})</Text>
                    </TouchableOpacity>

                    <TouchableOpacity accessibilityRole="button"
                      style={[styles.cstSecondaryBtn, { marginTop: 8 }]}
                      onPress={() => setStyleView('intro')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.cstSecondaryBtnText}>Back to Overview</Text>
                    </TouchableOpacity>
                  </View>
                );
              })()}
            </View>
          )}
        </View>
        )}

        {/* ════════════════════ CARD 5: AI ACTIVE TIME & SAFETY (DESKTOP V2 PARITY) ════════════════════ */}
        {SHOW_AI_ACTIVE_TIME && (
        <View style={[styles.v2Card, openCards.activeTime && styles.v2CardOpen]}>
          <View style={styles.v2CardHeader}>
            <TouchableOpacity accessibilityRole="button"
              style={[styles.cardTitleWrap, { flex: 1 }]}
              onPress={() => toggleCard('activeTime')}
              activeOpacity={0.85}
            >
              <Ionicons name="time-outline" size={17} color={uiTheme.colors.success} />
              <Text style={styles.v2CardTitle}>AI Active Time</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* Range summary in header */}
              <Text style={styles.atHeaderRangeText}>
                {form.activeHours?.enabled !== false
                  ? `${minsToDisplay(timeToMins(form.activeHours?.startTime || '09:00'))} – ${minsToDisplay(timeToMins(form.activeHours?.endTime || '22:00'))}`
                  : '24/7 (All Day)'}
              </Text>

              {/* Master Active Hours Toggle matching Desktop V2 #atToggleInput */}
              <Switch
                value={form.activeHours?.enabled !== false}
                onValueChange={(val) => {
                  updateField('activeHours.enabled', val);
                  if (val && !openCards.activeTime) {
                    toggleCard('activeTime');
                  }
                }}
                trackColor={{ false: uiTheme.colors.elevatedHigh, true: uiTheme.colors.primary }}
                thumbColor={uiTheme.colors.white}
                ios_backgroundColor={uiTheme.colors.elevatedHigh}
              />

              <TouchableOpacity accessibilityRole="button"
                onPress={() => toggleCard('activeTime')}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={openCards.activeTime ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={uiTheme.colors.muted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Collapsed Summary Chips */}
          {!openCards.activeTime && (
            <View style={styles.collapsedRow}>
              <View style={styles.v2Chip}>
                <Ionicons name="calendar" size={11} color={uiTheme.colors.success} />
                <Text style={styles.v2ChipText}>{getActiveTimeSummary()}</Text>
              </View>
            </View>
          )}

          {/* Expanded Body */}
          {openCards.activeTime && (
            <View style={styles.v2CardBody}>
              <Text style={styles.fieldDesc}>
                Set the active operating window during which your AI Wingman operates on Tinder:
              </Text>

              {/* 24-Hour Range Slider Track (Desktop V2 .at-track-row Parity) */}
              <View style={styles.subBox}>
                <View style={styles.rowBetween}>
                  <Text style={styles.subBoxTitle}>Operating Hours Window</Text>
                  <Text style={{ ...uiTheme.type.footnote, fontFamily: uiTheme.fonts.strong, color: uiTheme.colors.success }}>
                    {form.activeHours?.enabled !== false ? 'Scheduled Active' : '24/7 Always On'}
                  </Text>
                </View>

                <TimeRangeSlider
                  startVal={form.activeHours?.startTime || '09:00'}
                  endVal={form.activeHours?.endTime || '22:00'}
                  disabled={form.activeHours?.enabled === false}
                  onValuesChange={(s, e) => {
                    updateField('activeHours.startTime', s);
                    updateField('activeHours.endTime', e);
                    updateField('activeHours.preset', 'Custom');
                    if (form.activeHours?.enabled === false) {
                      updateField('activeHours.enabled', true);
                    }
                  }}
                />

                {/* 24-Hour Schedule Timeline Visualizer Bar */}
                <View style={styles.timelineWrap}>
                  <View style={styles.timelineBg}>
                    {form.activeHours?.enabled !== false && (() => {
                      const sMins = timeToMins(form.activeHours?.startTime || '09:00');
                      const eMins = timeToMins(form.activeHours?.endTime || '22:00');
                      const leftPct = (sMins / 1440) * 100;
                      const widthPct = Math.max(((eMins - sMins) / 1440) * 100, 2);
                      return (
                        <View
                          style={[
                            styles.timelineActiveFill,
                            { left: `${leftPct}%`, width: `${widthPct}%` }
                          ]}
                        />
                      );
                    })()}
                  </View>
                  <View style={styles.timelineMarkers}>
                    <Text style={styles.timelineMarkerText}>12 AM</Text>
                    <Text style={styles.timelineMarkerText}>6 AM</Text>
                    <Text style={styles.timelineMarkerText}>12 PM</Text>
                    <Text style={styles.timelineMarkerText}>6 PM</Text>
                    <Text style={styles.timelineMarkerText}>12 AM</Text>
                  </View>
                </View>

                {/* Schedule Presets (24/7, Day, Evening, Custom) */}
                <Text style={[styles.inputLabel, { marginTop: 14 }]}>Quick Presets</Text>
                <View style={styles.chipRow}>
                  {ACTIVE_HOUR_PRESETS.map(p => {
                    const isActive = (form.activeHours?.preset === p) ||
                      (p === '24/7' && form.activeHours?.enabled === false) ||
                      (p === 'Day (9am-10pm)' && form.activeHours?.enabled !== false && form.activeHours?.startTime === '09:00' && form.activeHours?.endTime === '22:00') ||
                      (p === 'Evening (6pm-12am)' && form.activeHours?.enabled !== false && form.activeHours?.startTime === '18:00' && form.activeHours?.endTime === '23:59');

                    return (
                      <TouchableOpacity accessibilityRole="button"
                        key={p}
                        style={[styles.chip, isActive && styles.chipActive]}
                        onPress={() => {
                          if (p === '24/7') {
                            updateField('activeHours.enabled', false);
                            updateField('activeHours.preset', '24/7');
                            updateField('activeHours.startTime', '00:00');
                            updateField('activeHours.endTime', '23:59');
                          } else if (p === 'Day (9am-10pm)') {
                            updateField('activeHours.enabled', true);
                            updateField('activeHours.preset', 'Day (9am-10pm)');
                            updateField('activeHours.startTime', '09:00');
                            updateField('activeHours.endTime', '22:00');
                          } else if (p === 'Evening (6pm-12am)') {
                            updateField('activeHours.enabled', true);
                            updateField('activeHours.preset', 'Evening (6pm-12am)');
                            updateField('activeHours.startTime', '18:00');
                            updateField('activeHours.endTime', '23:59');
                          } else {
                            updateField('activeHours.enabled', true);
                            updateField('activeHours.preset', 'Custom');
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                          {p}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          )}
        </View>
        )}

      </ScrollView>

      {/* ─── Generic V2 Info / Tooltip Modal (Desktop V2 Tooltip Parity) ─── */}
      <Modal
        visible={!!tooltipModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setTooltipModal(null)}
      >
        <TouchableOpacity accessibilityRole="button"
          style={styles.simLangModalOverlay}
          activeOpacity={1}
          onPress={() => setTooltipModal(null)}
        >
          <View style={[styles.simLangModalContent, styles.tooltipContent]} accessibilityViewIsModal onStartShouldSetResponder={() => true}>
            <View style={styles.tooltipHeader}>
              <View style={styles.tooltipTitleRow}>
                <IconWell icon="information-circle-outline" tone="primary" size={40} />
                <AppText variant="title2" style={styles.tooltipTitle} accessibilityRole="header" numberOfLines={2}>{tooltipModal?.title || 'How it works'}</AppText>
              </View>
              <IconButton icon="close" size={36} iconSize={18} onPress={() => setTooltipModal(null)} accessibilityLabel="Close" />
            </View>

            <View style={styles.tooltipLines}>
              {tooltipModal?.lines?.map((line, idx) => (
                <View key={idx} style={styles.tooltipLineRow}>
                  <AppText variant="callout" style={styles.tooltipLineText}>{line}</AppText>
                </View>
              ))}
            </View>

            <AppButton
              title="Got it"
              onPress={() => setTooltipModal(null)}
              style={styles.tooltipBtn}
            />
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const c = uiTheme.colors;
const sp = uiTheme.spacing;
const r = uiTheme.radius;
const ty = uiTheme.type;

const styles = createStyles(() => ({
  // ── Wingman mission card ──
  wmFrame: { borderRadius: uiTheme.radius.xl + 1, padding: 1.2, ...uiTheme.shadows.md },
  wmCard: { borderRadius: uiTheme.radius.xl, overflow: 'hidden', backgroundColor: uiTheme.colors.surface, padding: uiTheme.spacing.lg, gap: uiTheme.spacing.lg },
  wmWatermark: { position: 'absolute', right: -28, top: -20, transform: [{ rotate: '-12deg' }] },
  wmHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: uiTheme.spacing.sm },
  wmLabelRow: { flexDirection: 'row', alignItems: 'center', gap: uiTheme.spacing.sm },
  wmModePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: uiTheme.radius.pill, backgroundColor: uiTheme.colors.neutralSoft, borderWidth: 1, borderColor: uiTheme.colors.neutralBorder, flexShrink: 1 },
  wmModePillOn: { backgroundColor: uiTheme.colors.secondarySoft, borderColor: uiTheme.colors.secondaryBorder },
  wmModeText: { ...uiTheme.type.footnote, fontFamily: uiTheme.fonts.label, color: uiTheme.colors.muted, flexShrink: 1 },
  wmGoal: { flexDirection: 'row', alignItems: 'center', gap: uiTheme.spacing.md },
  wmGoalIcon: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', ...uiTheme.shadows.glow },
  wmGoalCopy: { flex: 1, minWidth: 0, gap: 1 },
  wmJourney: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: uiTheme.spacing.sm, paddingHorizontal: uiTheme.spacing.md, borderRadius: uiTheme.radius.lg, backgroundColor: alpha(uiTheme.colors.background, 0.45), borderWidth: 1, borderColor: uiTheme.colors.hairline },
  wmStep: { alignItems: 'center', gap: 5, minWidth: 56, maxWidth: 96 },
  wmStepDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  wmStepDotPlain: { backgroundColor: uiTheme.colors.primarySoft, borderWidth: 1, borderColor: uiTheme.colors.primaryBorder },
  wmJourneyLine: { flex: 1, height: 2, borderRadius: 1, marginTop: 14 },
  wmStepLabel: { ...uiTheme.type.footnote, fontSize: 11, lineHeight: 14, color: uiTheme.colors.muted, textAlign: 'center' },
  wmStepLabelGoal: { fontFamily: uiTheme.fonts.label, color: uiTheme.colors.text },
  wmHandles: { flexDirection: 'row', gap: uiTheme.spacing.sm },
  wmHandle: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: uiTheme.spacing.sm, padding: uiTheme.spacing.md, borderRadius: uiTheme.radius.md, backgroundColor: uiTheme.colors.elevated, borderWidth: 1, borderColor: uiTheme.colors.hairline },
  wmHandleCopy: { flex: 1, minWidth: 0 },
  wmHandleName: { ...uiTheme.type.subhead, fontFamily: uiTheme.fonts.label, color: uiTheme.colors.text },
  wmHandleStateRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  wmHandleState: { ...uiTheme.type.footnote, fontSize: 11, lineHeight: 14, fontFamily: uiTheme.fonts.label },
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: sp.xl,
    backgroundColor: c.background,
  },
  loadingText: {
    ...ty.footnote,
    color: c.muted,
    marginTop: sp.md,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: sp.xxs,
    paddingTop: sp.xs,
    paddingBottom: sp.section,
    gap: sp.xxl,
  },

  // ─── Redesigned page: intro summary ───
  heroCard: {
    borderRadius: r.xl,
    borderWidth: 1,
    borderColor: c.primaryBorder,
    overflow: 'hidden',
    padding: sp.lg,
    backgroundColor: c.surface,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    marginTop: sp.xxs,
    marginBottom: sp.xxs,
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.hairline,
    marginVertical: sp.md,
  },
  heroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp.sm,
  },
  heroBadge: {
    maxWidth: '100%',
  },
  heroBadgeText: {
    flexShrink: 1,
  },

  // ─── Redesigned page: sections ───
  pageSection: {
    gap: sp.xxs,
  },
  groupCard: {
    overflow: 'hidden',
  },
  goalList: {
    gap: sp.sm,
    marginBottom: sp.md,
  },
  // Tablet/XL: goal cards flow 2–3 across instead of one very wide row.
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    minHeight: 76,
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
    borderRadius: r.card,
    borderWidth: 1,
    borderColor: c.borderSubtle,
    backgroundColor: c.surface,
  },
  goalCardSelected: {
    backgroundColor: c.primarySoft,
    borderColor: c.primaryBorder,
  },
  goalCardCopy: {
    flex: 1,
    minWidth: 0,
  },
  goalCardDesc: {
    marginTop: sp.xxs,
  },
  goalRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  goalRadioSelected: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    minHeight: 64,
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
  },
  settingRowDisabled: {
    opacity: 0.6,
  },
  settingRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  settingRowSub: {
    marginTop: sp.xxs,
  },

  // ─── Redesigned page: contact handles ───
  handleRow: {
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
  },
  handleRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.divider,
  },
  // Tablet/XL: the two contact handles sit side by side, split by a vertical rule.
  handleGridCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  handleGridCell: {
    flex: 1,
    minWidth: 0,
  },
  handleGridCellSplit: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: c.divider,
  },
  handleRowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    minHeight: 44,
  },
  handleRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  handleSentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    marginTop: sp.xxs,
  },
  handleSentText: {
    flexShrink: 1,
    minWidth: 0,
  },
  handleInputWrap: {
    marginTop: sp.md,
  },
  handleInputLabel: {
    marginBottom: sp.xs,
    marginLeft: sp.xxs,
  },
  handleInput: {
    fontFamily: ty.body.fontFamily,
    fontSize: ty.body.fontSize,
    height: uiTheme.layout.inputHeight,
    paddingHorizontal: sp.lg,
    paddingVertical: 0,
    backgroundColor: c.elevated,
    borderRadius: r.input,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
  },
  handleInputMissing: {
    borderColor: c.warningBorder,
  },
  handleHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    marginTop: sp.sm,
    marginLeft: sp.xxs,
  },
  handleHintText: {
    flex: 1,
    minWidth: 0,
  },

  // ─── Redesigned page: segmented control ───
  segmented: {
    flexDirection: 'row',
    padding: SEGMENT_PAD,
    borderWidth: SEGMENT_BORDER,
    borderColor: c.border,
    borderRadius: r.md,
    backgroundColor: c.elevated,
  },
  segmentThumb: {
    position: 'absolute',
    top: SEGMENT_PAD,
    bottom: SEGMENT_PAD,
    left: SEGMENT_PAD,
    borderRadius: r.sm,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: uiTheme.layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: sp.xs,
    borderRadius: r.sm,
  },
  segmentText: {
    textAlign: 'center',
  },
  genderHintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp.xs,
    marginTop: sp.md,
  },
  genderHintText: {
    flex: 1,
    minWidth: 0,
  },

  // ─── V2 Accordion Cards ───
  v2Card: {
    backgroundColor: c.surface,
    borderRadius: r.card,
    borderWidth: 1,
    borderColor: c.borderSubtle,
    overflow: 'hidden',
  },
  v2CardOpen: {
    borderColor: c.primaryBorder,
  },
  v2CardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp.md,
    minHeight: 64,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.md,
  },
  cardTitleWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
  },
  v2CardTitle: {
    ...ty.headline,
    color: c.text,
    flexShrink: 1,
  },

  // ─── Collapsed Summary Chips ───
  collapsedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp.sm,
    paddingHorizontal: sp.lg,
    paddingBottom: sp.lg,
  },
  v2Chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    maxWidth: '100%',
    backgroundColor: c.neutralSoft,
    paddingHorizontal: sp.md - 2,
    paddingVertical: sp.xs,
    borderRadius: r.pill,
    borderWidth: 1,
    borderColor: c.neutralBorder,
  },
  v2ChipText: {
    ...ty.caption,
    fontFamily: uiTheme.fonts.label,
    color: c.textSecondary,
    flexShrink: 1,
  },

  // ─── Expanded Card Body ───
  v2CardBody: {
    paddingHorizontal: sp.lg,
    paddingBottom: sp.lg,
    paddingTop: sp.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: c.divider,
  },
  fieldDesc: {
    ...ty.footnote,
    color: c.muted,
    marginBottom: sp.md,
  },

  // ─── Radio Group ───
  radioGroup: {
    gap: sp.sm,
    marginBottom: sp.md,
  },
  goalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    backgroundColor: c.elevated,
    borderRadius: r.input,
    padding: sp.md,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  goalOptionSelected: {
    borderColor: c.primaryBorder,
    backgroundColor: c.primarySoft,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: c.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleActive: {
    borderColor: c.primary,
  },
  radioInnerCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: c.primary,
  },
  goalOptionLabel: {
    ...ty.bodyStrong,
    color: c.text,
  },
  goalOptionSub: {
    ...ty.footnote,
    color: c.muted,
    marginTop: sp.xxs,
  },

  // ─── Sub-Boxes & Inputs ───
  subBox: {
    backgroundColor: c.elevated,
    borderRadius: r.lg,
    padding: sp.lg,
    borderWidth: 1,
    borderColor: c.hairline,
    marginTop: sp.md,
  },
  subBoxTitle: {
    ...ty.label,
    fontFamily: uiTheme.fonts.heading,
    color: c.text,
    marginBottom: sp.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp.sm,
  },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    backgroundColor: c.surface,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs + 2,
    borderRadius: r.pill,
    borderWidth: 1,
    borderColor: c.border,
  },
  chipActive: {
    backgroundColor: c.primarySoft,
    borderColor: c.primaryBorder,
  },
  chipText: {
    ...ty.subhead,
    color: c.textSecondary,
  },
  chipTextActive: {
    fontFamily: uiTheme.fonts.label,
    color: c.text,
  },
  inputGroup: {
    marginTop: sp.md,
  },
  inputLabel: {
    ...ty.label,
    color: c.textSecondary,
    marginBottom: sp.sm,
  },
  textInput: {
    ...ty.callout,
    minHeight: uiTheme.layout.touchTarget,
    backgroundColor: c.surface,
    borderRadius: r.input,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
  },
  textArea: {
    ...ty.callout,
    backgroundColor: c.surface,
    borderRadius: r.input,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
    padding: sp.md,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: sp.md,
    marginTop: sp.sm,
  },
  switchRow: {
    minHeight: 48,
    marginTop: 0,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  labelMuted: {
    ...ty.footnote,
    color: c.muted,
  },
  smallInput: {
    ...ty.subhead,
    backgroundColor: c.surface,
    borderRadius: r.sm,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
    width: 56,
    minHeight: uiTheme.layout.touchTarget,
    textAlign: 'center',
    paddingVertical: sp.xs,
    fontVariant: ['tabular-nums'],
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp.md,
    minHeight: 56,
    paddingVertical: sp.sm,
  },
  v2ValueBadge: {
    backgroundColor: c.primarySoft,
    paddingHorizontal: sp.sm + 2,
    paddingVertical: sp.xxs + 1,
    borderRadius: r.pill,
    borderWidth: 1,
    borderColor: c.primaryBorder,
  },
  v2ValueBadgeText: {
    ...ty.caption,
    fontFamily: uiTheme.fonts.strong,
    color: c.accent,
    fontVariant: ['tabular-nums'],
  },
  toggleTitle: {
    ...ty.bodyStrong,
    color: c.text,
    flexShrink: 1,
  },
  toggleSub: {
    ...ty.footnote,
    color: c.muted,
    marginTop: sp.xxs,
  },
  safetyChipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    backgroundColor: c.successSoft,
    paddingHorizontal: sp.sm,
    paddingVertical: sp.xxs,
    borderRadius: r.pill,
    borderWidth: 1,
    borderColor: c.successBorder,
  },
  safetyChipBadgeText: {
    ...ty.caption,
    fontFamily: uiTheme.fonts.strong,
    color: c.success,
  },
  subBoxDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.divider,
    marginVertical: sp.md,
  },
  speedButtonGroup: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: r.md,
    padding: 3,
    gap: 3,
    borderWidth: 1,
    borderColor: c.border,
  },
  speedBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    paddingVertical: sp.sm,
    paddingHorizontal: sp.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: r.sm,
  },
  speedBtnActive: {
    backgroundColor: c.primary,
    ...uiTheme.shadows.sm,
  },
  speedBtnText: {
    ...ty.subhead,
    color: c.muted,
    textAlign: 'center',
  },
  speedBtnTextActive: {
    fontFamily: uiTheme.fonts.label,
    color: c.onPrimary,
  },

  // ─── Chat Style Training (CST) V2 Parity Styles ───
  cstIntroContainer: {
    paddingVertical: sp.sm,
  },
  cstIntroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: c.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: sp.md,
    borderWidth: 1,
    borderColor: c.infoBorder,
  },
  cstIntroTitle: {
    ...ty.section,
    color: c.text,
    textAlign: 'center',
    marginBottom: sp.xs,
  },
  cstIntroDesc: {
    ...ty.callout,
    color: c.muted,
    textAlign: 'center',
    marginBottom: sp.lg,
    paddingHorizontal: sp.sm,
  },
  cstTrainedBar: {
    backgroundColor: c.elevated,
    borderRadius: r.md,
    padding: sp.md,
    borderWidth: 1,
    borderColor: c.hairline,
    marginBottom: sp.sm,
  },
  cstTrainedBarLabel: {
    ...ty.overline,
    color: c.muted,
    textTransform: 'uppercase',
    marginBottom: sp.sm,
  },
  cstTrainedChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp.sm,
  },
  cstTrainedPill: {
    minHeight: 32,
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderRadius: r.pill,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs,
    borderWidth: 1,
    borderColor: c.border,
  },
  cstTrainedPillActive: {
    borderColor: c.infoBorder,
    backgroundColor: c.infoSoft,
  },
  cstTrainedPillText: {
    ...ty.caption,
    fontFamily: uiTheme.fonts.label,
    color: c.muted,
  },
  cstTrainedPillTextActive: {
    fontFamily: uiTheme.fonts.strong,
    color: c.info,
  },
  cstStartBtn: {
    minHeight: uiTheme.layout.buttonHeight,
    backgroundColor: c.primary,
    borderRadius: r.button,
    paddingVertical: sp.md,
    paddingHorizontal: sp.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.sm,
    marginTop: sp.lg,
    ...uiTheme.shadows.glow,
  },
  cstStartBtnText: {
    ...ty.button,
    color: c.onPrimary,
  },
  cstViewTrainedBtn: {
    marginTop: sp.sm,
    minHeight: uiTheme.layout.buttonHeightSmall + 4,
    paddingVertical: sp.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: r.button,
    borderWidth: 1,
    borderColor: c.infoBorder,
    backgroundColor: c.infoSoft,
  },
  cstViewTrainedBtnText: {
    ...ty.buttonSmall,
    color: c.info,
  },

  // CST Simulator
  cstSimContainer: {
    backgroundColor: c.elevated,
    borderRadius: r.lg,
    borderWidth: 1,
    borderColor: c.hairline,
    padding: sp.md,
  },
  cstSimTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.divider,
    paddingBottom: sp.md,
  },
  cstSaveExitBtn: {
    minHeight: uiTheme.layout.touchTarget,
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: r.sm,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs,
  },
  cstSaveExitBtnText: {
    ...ty.buttonSmall,
    color: c.text,
  },
  cstCancelBtn: {
    width: uiTheme.layout.touchTarget,
    height: uiTheme.layout.touchTarget,
    borderRadius: r.sm + 4,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cstProgressWrap: {
    paddingVertical: sp.sm,
  },
  cstProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp.xs,
  },
  cstProgressLabel: {
    ...ty.caption,
    fontFamily: uiTheme.fonts.label,
    color: c.muted,
  },
  cstProgressValue: {
    ...ty.caption,
    fontFamily: uiTheme.fonts.strong,
    color: c.info,
    fontVariant: ['tabular-nums'],
  },
  cstProgressBarBg: {
    height: 4,
    backgroundColor: c.elevatedHigh,
    borderRadius: r.pill,
    overflow: 'hidden',
  },
  cstProgressBarFill: {
    height: '100%',
    backgroundColor: c.info,
    borderRadius: r.pill,
  },
  cstMessagesScroll: {
    maxHeight: 230,
    minHeight: 140,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.divider,
    marginVertical: sp.xs,
  },
  simAvatarWrapper: {
    position: 'relative',
  },
  simAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  simAvatarOnlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: c.success,
    borderWidth: 2,
    borderColor: c.elevated,
  },
  simMatchName: {
    ...ty.label,
    color: c.text,
  },
  simDateSeparator: {
    alignItems: 'center',
    marginVertical: sp.xs,
  },
  simDateSeparatorText: {
    ...ty.overline,
    color: c.muted,
  },
  simMatchRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: sp.xs + 2,
    maxWidth: '88%',
    alignSelf: 'flex-start',
  },
  simMatchAvatarTiny: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: c.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: sp.xxs,
  },
  simBubble: {
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderRadius: r.lg,
    maxWidth: '85%',
  },
  simBubbleMatch: {
    backgroundColor: c.elevatedHigh,
    borderWidth: 1,
    borderColor: c.hairline,
    borderBottomLeftRadius: sp.xs,
  },
  simBubbleUser: {
    backgroundColor: c.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: sp.xs,
  },
  simBubbleTextMatch: {
    ...ty.callout,
    color: c.text,
  },
  simBubbleText: {
    ...ty.callout,
    color: c.text,
  },
  simBubbleTextUser: {
    ...ty.callout,
    color: c.onPrimary,
  },
  simActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: sp.sm,
    paddingVertical: sp.xs,
  },
  cstSaveInlinePill: {
    minHeight: 32,
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderRadius: r.pill,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs,
    borderWidth: 1,
    borderColor: c.border,
  },
  cstSaveInlinePillText: {
    ...ty.caption,
    fontFamily: uiTheme.fonts.strong,
    color: c.accent,
  },
  cstProfilesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    minHeight: 32,
    backgroundColor: c.infoSoft,
    borderRadius: r.pill,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs,
    borderWidth: 1,
    borderColor: c.infoBorder,
    marginRight: sp.xs,
  },
  cstProfilesBtnText: {
    ...ty.caption,
    fontFamily: uiTheme.fonts.strong,
    color: c.info,
  },
  simLangPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    minHeight: 32,
    backgroundColor: c.primarySoft,
    borderRadius: r.pill,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs,
    borderWidth: 1,
    borderColor: c.primaryBorder,
  },
  simLangPillText: {
    ...ty.caption,
    fontFamily: uiTheme.fonts.strong,
    color: c.accent,
  },
  simInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
  },
  simTextInput: {
    ...ty.callout,
    flex: 1,
    minWidth: 0,
    backgroundColor: c.surface,
    borderRadius: r.pill,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.sm,
    height: uiTheme.layout.touchTarget,
  },
  simTextInputShaking: {
    borderColor: c.warning,
    borderWidth: 1.5,
    backgroundColor: c.warningSoft,
  },
  simInputWarningText: {
    ...ty.footnote,
    fontFamily: uiTheme.fonts.label,
    color: c.warning,
    marginTop: sp.xs,
    marginLeft: sp.sm,
  },
  simSendBtn: {
    width: uiTheme.layout.touchTarget,
    height: uiTheme.layout.touchTarget,
    borderRadius: uiTheme.layout.touchTarget / 2,
    backgroundColor: c.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // CST Insights (Completion Screen)
  cstInsightsContainer: {
    paddingVertical: sp.xs,
  },
  cstInsightsHeader: {
    alignItems: 'center',
    marginBottom: sp.lg,
  },
  cstBadgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    backgroundColor: c.successSoft,
    paddingHorizontal: sp.sm + 2,
    paddingVertical: sp.xs,
    borderRadius: r.pill,
    borderWidth: 1,
    borderColor: c.successBorder,
    marginBottom: sp.sm,
  },
  cstBadgeSuccessText: {
    ...ty.caption,
    fontFamily: uiTheme.fonts.strong,
    color: c.success,
  },
  cstInsightsTitle: {
    ...ty.section,
    color: c.text,
    textAlign: 'center',
    marginBottom: sp.xs,
  },
  cstInsightsSub: {
    ...ty.footnote,
    color: c.muted,
    textAlign: 'center',
    paddingHorizontal: sp.md,
  },
  cstMetricGrid: {
    gap: sp.sm,
  },
  cstMetricCard: {
    backgroundColor: c.elevated,
    borderRadius: r.md,
    padding: sp.md,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  cstMetricTitle: {
    ...ty.label,
    color: c.text,
  },
  cstMetricValue: {
    ...ty.footnote,
    color: c.muted,
    marginTop: sp.xs,
    marginLeft: sp.xl,
  },
  cstRestartBtn: {
    width: uiTheme.layout.touchTarget,
    height: uiTheme.layout.touchTarget,
    borderRadius: r.sm + 4,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cstTraitsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp.sm,
    justifyContent: 'center',
    marginBottom: sp.lg,
  },
  cstTraitChip: {
    backgroundColor: c.neutralSoft,
    paddingHorizontal: sp.md - 2,
    paddingVertical: sp.xs,
    borderRadius: r.pill,
    borderWidth: 1,
    borderColor: c.neutralBorder,
  },
  cstTraitChipText: {
    ...ty.caption,
    fontFamily: uiTheme.fonts.label,
    color: c.text,
  },
  cstTrainAnotherBtn: {
    minHeight: uiTheme.layout.buttonHeight,
    backgroundColor: c.primary,
    borderRadius: r.button,
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.sm,
  },
  cstTrainAnotherBtnText: {
    ...ty.button,
    color: c.onPrimary,
  },
  cstSecondaryBtn: {
    minHeight: uiTheme.layout.buttonHeightSmall + 4,
    paddingVertical: sp.sm,
    paddingHorizontal: sp.lg,
    borderRadius: r.button,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.elevated,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.sm,
  },
  cstSecondaryBtnText: {
    ...ty.buttonSmall,
    color: c.text,
  },
  simSystemHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    backgroundColor: c.warningSoft,
    borderRadius: r.md,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    marginVertical: sp.xs,
    borderWidth: 1,
    borderColor: c.warningBorder,
    alignSelf: 'center',
    maxWidth: '92%',
  },
  simSystemHintText: {
    ...ty.footnote,
    color: c.warning,
    fontStyle: 'italic',
    flex: 1,
    minWidth: 0,
  },
  cstFinishBanner: {
    backgroundColor: c.infoSoft,
    borderWidth: 1,
    borderColor: c.infoBorder,
    borderRadius: r.lg,
    padding: sp.lg,
    alignItems: 'center',
    marginVertical: sp.sm,
  },
  cstFinishTitle: {
    ...ty.headline,
    color: c.text,
    textAlign: 'center',
    marginBottom: sp.xs,
  },
  cstFinishSub: {
    ...ty.footnote,
    color: c.muted,
    textAlign: 'center',
    marginBottom: sp.md,
  },
  cstFinishBtn: {
    minHeight: uiTheme.layout.buttonHeightSmall + 4,
    justifyContent: 'center',
    backgroundColor: c.primary,
    paddingHorizontal: sp.xl,
    paddingVertical: sp.sm,
    borderRadius: r.button,
  },
  cstFinishBtnText: {
    ...ty.buttonSmall,
    color: c.onPrimary,
  },
  cstAiSummaryWrap: {
    backgroundColor: c.elevated,
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: c.hairline,
    padding: sp.md,
    marginBottom: sp.md,
  },
  cstAiSummaryLabel: {
    ...ty.overline,
    color: c.accent,
    marginBottom: sp.xs,
    textTransform: 'uppercase',
  },
  cstAiSummaryText: {
    ...ty.callout,
    color: c.text,
  },
  cstDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.xs,
    minHeight: uiTheme.layout.touchTarget,
    paddingVertical: sp.sm,
  },
  cstDeleteBtnText: {
    ...ty.buttonSmall,
    color: c.error,
  },

  // ─── Modals (simulator language picker, info tooltip) ───
  modalOverlay: {
    flex: 1,
    backgroundColor: c.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: sp.xl,
  },
  simLangModalOverlay: {
    flex: 1,
    backgroundColor: c.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: sp.xl,
  },
  simLangModalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: c.surface,
    borderRadius: r.sheet,
    borderWidth: 1,
    borderColor: c.hairline,
    padding: sp.xl,
    ...uiTheme.shadows.lg,
  },
  simLangModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: sp.md,
    paddingBottom: sp.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.divider,
    marginBottom: sp.sm,
  },
  simLangModalTitle: {
    ...ty.title2,
    color: c.text,
    flexShrink: 1,
  },
  simLangModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp.sm,
    minHeight: 48,
    paddingVertical: sp.sm,
    paddingHorizontal: sp.md,
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: 'transparent',
    marginVertical: sp.xxs,
  },
  simLangModalOptionSelected: {
    backgroundColor: c.primarySoft,
    borderWidth: 1,
    borderColor: c.primaryBorder,
  },
  simLangModalOptionText: {
    ...ty.bodyStrong,
    color: c.text,
  },
  tooltipContent: {
    maxWidth: 380,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp.md,
    marginBottom: sp.xs,
  },
  tooltipTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
  },
  tooltipTitle: {
    ...ty.title2,
    color: c.text,
    flexShrink: 1,
  },
  tooltipLines: {
    marginTop: sp.sm,
    gap: sp.md,
  },
  tooltipLineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sp.sm,
  },
  tooltipLineText: {
    ...ty.callout,
    color: c.textSecondary,
    flex: 1,
    minWidth: 0,
  },
  tooltipBtn: {
    marginTop: sp.xl,
  },

  // ─── Contact Section & Move Off App (Desktop V2 Parity) ───
  contactSection: {
    backgroundColor: c.elevated,
    borderRadius: r.lg,
    borderWidth: 1,
    borderColor: c.hairline,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.xs,
    marginTop: sp.md,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp.md,
    minHeight: 52,
    paddingVertical: sp.xs,
  },
  contactHeaderLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
  },
  contactHeaderTitle: {
    ...ty.bodyStrong,
    color: c.text,
    flexShrink: 1,
  },
  contactBody: {
    paddingTop: sp.sm,
    paddingBottom: sp.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.divider,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    minHeight: 48,
    marginVertical: sp.xxs,
  },
  contactRowSpaced: {
    marginTop: sp.md,
  },
  contactRowIcon: {
    width: 24,
    textAlign: 'center',
  },
  contactRowLabel: {
    ...ty.bodyStrong,
    color: c.text,
    flex: 1,
    minWidth: 0,
  },
  contactInput: {
    ...ty.callout,
    backgroundColor: c.surface,
    borderRadius: r.input,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    height: 48,
  },
  handleStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    marginTop: sp.sm,
    marginBottom: sp.xs,
    marginLeft: sp.xs,
  },
  handleStatText: {
    ...ty.footnote,
    color: c.muted,
    flexShrink: 1,
  },
  handleStatCount: {
    fontFamily: uiTheme.fonts.strong,
    fontVariant: ['tabular-nums'],
  },
  genderBlock: {
    marginTop: sp.xs,
  },
  genderSelector: {
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    marginTop: sp.xxs,
    backgroundColor: c.surface,
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  genderBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: uiTheme.layout.touchTarget,
    paddingVertical: sp.sm,
    paddingHorizontal: sp.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: r.sm,
  },
  genderBtnActive: {
    backgroundColor: c.primary,
    ...uiTheme.shadows.sm,
  },
  genderBtnText: {
    ...ty.subhead,
    fontFamily: uiTheme.fonts.label,
    color: c.muted,
  },
  genderBtnTextActive: {
    fontFamily: uiTheme.fonts.label,
    color: c.onPrimary,
  },
  helperNote: {
    ...ty.footnote,
    color: c.muted,
    marginTop: sp.sm,
  },

  // ─── AI Active Time (Desktop V2 Parity) ───
  atHeaderRangeText: {
    ...ty.caption,
    fontFamily: uiTheme.fonts.label,
    color: c.muted,
    fontVariant: ['tabular-nums'],
  },
  timelineWrap: {
    marginTop: sp.md,
    marginBottom: sp.xs,
  },
  timelineBg: {
    height: 6,
    backgroundColor: c.elevatedHigh,
    borderRadius: r.pill,
    overflow: 'hidden',
    position: 'relative',
  },
  timelineActiveFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: c.primary,
    borderRadius: r.pill,
  },
  timelineMarkers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: sp.xs,
    paddingHorizontal: sp.xxs,
  },
  timelineMarkerText: {
    ...ty.caption,
    color: c.textTertiary,
    fontVariant: ['tabular-nums'],
  },

  // ─── Desktop V2 Toast Banner ───
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.sm,
    backgroundColor: c.successSoft,
    borderColor: c.successBorder,
    borderWidth: 1,
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
    marginHorizontal: sp.md,
    marginTop: sp.md,
    borderRadius: r.input,
    zIndex: 99,
  },
  toastBannerText: {
    ...ty.label,
    color: c.success,
    flexShrink: 1,
  },

  // ─── Desktop V2 Sticky Save Bar ───
  saveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: c.elevated,
    borderTopWidth: 1,
    borderColor: c.hairline,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.md,
    ...uiTheme.shadows.lg,
  },
  saveBarProgress: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 3,
    backgroundColor: c.primary,
    borderTopLeftRadius: r.md,
    borderTopRightRadius: r.md,
  },
  saveBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    flex: 1,
    minWidth: 0,
    marginRight: sp.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  unsavedDot: {
    backgroundColor: c.warning,
  },
  savedDot: {
    backgroundColor: c.success,
  },
  saveBarText: {
    ...ty.footnote,
    fontFamily: uiTheme.fonts.label,
    color: c.muted,
  },
  saveBarTextUnsaved: {
    fontFamily: uiTheme.fonts.strong,
    color: c.accent,
  },
  saveBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
  },
  discardBtn: {
    minHeight: uiTheme.layout.touchTarget,
    justifyContent: 'center',
    paddingVertical: sp.sm,
    paddingHorizontal: sp.md,
    borderRadius: r.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: 'transparent',
  },
  discardBtnText: {
    ...ty.buttonSmall,
    color: c.textSecondary,
  },
  saveChangesBtn: {
    minHeight: uiTheme.layout.touchTarget,
    backgroundColor: c.primary,
    paddingVertical: sp.sm,
    paddingHorizontal: sp.lg,
    borderRadius: r.sm,
    alignItems: 'center',
    justifyContent: 'center',
    ...uiTheme.shadows.glow,
  },
  saveChangesBtnIdle: {
    backgroundColor: c.primary,
    opacity: 0.95,
  },
  saveChangesBtnSuccess: {
    backgroundColor: c.success,
    shadowColor: c.success,
  },
  saveChangesBtnText: {
    ...ty.buttonSmall,
    color: c.onPrimary,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
  },
  errorText: {
    ...ty.footnote,
    color: c.error,
    textAlign: 'center',
    marginBottom: sp.xs,
  },

  // ─── Swiping Location Capsule ───
  swipingLocationCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp.sm,
    backgroundColor: c.elevated,
    borderRadius: r.lg,
    borderWidth: 1,
    borderColor: c.hairline,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.md,
    marginTop: sp.md,
  },
  swipingLocationLeft: {
    flex: 1,
    minWidth: 0,
    paddingRight: sp.sm,
  },
  swipingLocationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: sp.sm,
    marginBottom: sp.xs,
  },
  swipingLocationTitle: {
    ...ty.overline,
    color: c.muted,
    textTransform: 'uppercase',
  },
  swipingLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    paddingHorizontal: sp.sm,
    paddingVertical: sp.xxs,
    borderRadius: r.pill,
  },
  swipingLocationBadgeGps: {
    backgroundColor: c.successSoft,
    borderWidth: 1,
    borderColor: c.successBorder,
  },
  swipingLocationBadgePassport: {
    backgroundColor: c.primarySoft,
    borderWidth: 1,
    borderColor: c.primaryBorder,
  },
  swipingLocationBadgeText: {
    ...ty.caption,
    fontFamily: uiTheme.fonts.strong,
    letterSpacing: 0.4,
  },
  swipingLocationCityRow: {
    marginTop: sp.xxs,
  },
  swipingLocationCityText: {
    ...ty.bodyStrong,
    color: c.text,
  },
  swipingLocationSub: {
    ...ty.footnote,
    color: c.textTertiary,
    marginTop: sp.xxs,
  },
  swipingLocationActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    minHeight: 36,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs + 2,
    borderRadius: r.pill,
    backgroundColor: c.primarySoft,
    borderWidth: 1,
    borderColor: c.primaryBorder,
  },
  swipingLocationActionText: {
    ...ty.buttonSmall,
    color: c.accent,
  },
}));
