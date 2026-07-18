export type Language = 'en' | 'zh';

export const translations = {
  nav_create: {
    en: 'Create',
    zh: '创建'
  },
  nav_overview: {
    en: 'Universe',
    zh: '愿力宇宙'
  },
  nav_daily: {
    en: 'Today',
    zh: '今日连接'
  },
  nav_wishes: {
    en: 'Wish Gallery',
    zh: '愿望画廊'
  },
  nav_log: {
    en: 'Logs',
    zh: '记录'
  },
  nav_fragments: {
    en: 'Fragments',
    zh: '碎片库'
  },
  nav_me: {
    en: 'Me',
    zh: '我'
  },
  nav_signin: {
    en: 'Sign in',
    zh: '登录'
  },
  nav_signout: {
    en: 'Sign out',
    zh: '退出登录'
  },
  hero_title: {
    en: 'Let wishes slowly take shape.',
    zh: '让愿望，慢慢成形。'
  },
  hero_subtitle: {
    en: 'A wish navigation system designed for sensitive souls and P-type explorers. From your present wishes to your life-long blueprints—every stage of your dreams is gently preserved.',
    zh: '为每个高敏感的灵魂与P型探索者设计的愿望导航系统。从你此刻的小愿望到几十岁的长期蓝图，每一个阶段的人生梦想，都能被温柔保存。'
  },
  hero_cta_primary: {
    en: 'Create my first wish',
    zh: '生成我的第一个愿望'
  },
  hero_cta_secondary: {
    en: 'See how it works',
    zh: '看看它怎么起作用'
  },
  hero_micro: {
    en: 'No streaks, no persistence required. Just leave your wish, the system takes care of the rest.',
    zh: '无需打卡，无需坚持。你只需要留下愿望，其余交给系统。'
  },
  section_problem_title: {
    en: 'Why this exists',
    zh: '为什么需要它'
  },
  section_problem_1: {
    en: 'Wishes fade when the world is too loud.',
    zh: '世界太吵时，愿望很容易消失。'
  },
  section_problem_2: {
    en: 'Traditional tools chase efficiency and rules. We guard your feelings and heart.',
    zh: '传统工具追逐效率和规律，这里只守护你的感受和心。'
  },
  section_problem_3: {
    en: 'Let us feel, connect, and manifest wishes together.',
    zh: '让我们一起感受，连接和显化愿望。'
  },
  section_card_title: {
    en: 'Wish Card: keep a relationship, not a task.',
    zh: '愿力卡：把愿望当关系，而不是任务。'
  },
  section_gallery_title: {
    en: 'Wish Gallery: your wishes live here.',
    zh: '愿望画廊：愿望会住在这里。'
  },
  auth_title: {
    en: 'Sign in',
    zh: '登录'
  },
  auth_subtitle: {
    en: 'Use Google or email + password to continue.',
    zh: '使用 Google 或 邮箱 + 密码 登录。'
  },
  auth_email: {
    en: 'Email',
    zh: '邮箱'
  },
  auth_password: {
    en: 'Password',
    zh: '密码'
  },
  auth_login: {
    en: 'Sign in',
    zh: '登录'
  },
  auth_signup: {
    en: 'Create account',
    zh: '创建账号'
  },
  auth_google: {
    en: 'Continue with Google',
    zh: '使用 Google 登录'
  },
  auth_hint: {
    en: 'We keep things calm. No streaks, no pressure, no public data.',
    zh: '我们保持克制：不打卡、不压力、不公开。'
  },
  auth_required_title: {
    en: 'Sign in to keep your wishes safe.',
    zh: '登录后才可以保存你的愿望。'
  },
  auth_required_body: {
    en: 'Your wishes live with your account. Sign in to continue.',
    zh: '你的愿望与账号绑定，请先登录。'
  },
  auth_required_button: {
    en: 'Go to login',
    zh: '去登录'
  },
  loading: {
    en: 'Loading...',
    zh: '加载中…'
  },
  language_label: {
    en: 'EN',
    zh: '中文'
  },
  overview_title: {
    en: 'Star Map',
    zh: '星图'
  },
  daily_title: {
    en: 'Today',
    zh: '今日'
  },
  wishes_title: {
    en: 'Wish Cards',
    zh: '愿力卡'
  },
  log_title: {
    en: 'Logs',
    zh: '记录'
  },
  fragments_title: {
    en: 'Fragments',
    zh: '碎片库'
  },
  me_title: {
    en: 'Me',
    zh: '我'
  },
  placeholder_copy: {
    en: 'We are building this space with care.',
    zh: '我们正在认真搭建这个空间。'
  }
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: Language) {
  return translations[key][lang];
}
