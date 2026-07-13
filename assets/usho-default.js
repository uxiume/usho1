(function () {
  var root = document.documentElement;
  var themeButton = document.getElementById("theme-toggle");
  var rippleButton = document.getElementById("ripple-toggle");
  var languageSelect = document.getElementById("language-select");
  var rippleLabel = document.getElementById("ripple-label");
  var themeLabel = document.getElementById("theme-label");
  var modes = ["system", "light", "dark"];
  var labels = {
    "zh-CN": { ripple: "水波纹", theme: "颜色模式", eyebrow: "USHO 默认主题", intro: "记录思考、生活与持续发生的变化。", latest: "博客文章", welcome: "欢迎来到我的博客", excerpt: "这个博客由 UshoHub 创建。你可以在 UshoHub 中编辑内容、管理语言并发布新的内容。", read: "阅读全文", empty: "更多内容正在准备中" },
    en: { ripple: "Ripple", theme: "Theme", eyebrow: "USHO DEFAULT THEME", intro: "A place for notes, ideas, and everything that keeps changing.", latest: "Latest writing", welcome: "Welcome to my blog", excerpt: "This blog was created with UshoHub. Use UshoHub to edit, manage languages, and publish new content.", read: "Read more", empty: "More content is on the way" },
    ja: { ripple: "波紋", theme: "テーマ", eyebrow: "USHO デフォルトテーマ", intro: "思考、暮らし、変化を記録する場所。", latest: "最新の投稿", welcome: "ブログへようこそ", excerpt: "このブログは UshoHub で作成されました。UshoHub で編集、言語管理、公開ができます。", read: "続きを読む", empty: "新しいコンテンツを準備中です" },
    ko: { ripple: "물결", theme: "테마", eyebrow: "USHO 기본 테마", intro: "생각과 일상, 계속되는 변화를 기록하는 공간입니다.", latest: "최신 글", welcome: "블로그에 오신 것을 환영합니다", excerpt: "이 블로그는 UshoHub로 만들었습니다. UshoHub에서 편집, 언어 관리 및 게시할 수 있습니다.", read: "더 보기", empty: "새 콘텐츠를 준비하고 있습니다" },
    fr: { ripple: "Ondes", theme: "Thème", eyebrow: "THÈME USHO PAR DÉFAUT", intro: "Un espace pour les notes, les idées et ce qui évolue.", latest: "Dernières publications", welcome: "Bienvenue sur mon blog", excerpt: "Ce blog a été créé avec UshoHub. Modifiez le contenu, gérez les langues et publiez depuis UshoHub.", read: "Lire la suite", empty: "D'autres contenus arrivent bientôt" },
    de: { ripple: "Wellen", theme: "Theme", eyebrow: "USHO STANDARDTHEME", intro: "Ein Ort für Notizen, Ideen und alles, was sich verändert.", latest: "Neueste Beiträge", welcome: "Willkommen in meinem Blog", excerpt: "Dieser Blog wurde mit UshoHub erstellt. Inhalte, Sprachen und Veröffentlichungen werden dort verwaltet.", read: "Weiterlesen", empty: "Weitere Inhalte folgen" },
    es: { ripple: "Ondas", theme: "Tema", eyebrow: "TEMA PREDETERMINADO DE USHO", intro: "Un espacio para notas, ideas y todo lo que sigue cambiando.", latest: "Publicaciones recientes", welcome: "Bienvenido a mi blog", excerpt: "Este blog fue creado con UshoHub. Edita contenido, gestiona idiomas y publica desde UshoHub.", read: "Leer más", empty: "Pronto habrá más contenido" },
    pt: { ripple: "Ondas", theme: "Tema", eyebrow: "TEMA PADRÃO USHO", intro: "Um espaço para notas, ideias e tudo o que continua mudando.", latest: "Publicações recentes", welcome: "Bem-vindo ao meu blog", excerpt: "Este blog foi criado com UshoHub. Edite conteúdo, gerencie idiomas e publique pelo UshoHub.", read: "Ler mais", empty: "Mais conteúdo em breve" },
    ru: { ripple: "Волны", theme: "Тема", eyebrow: "ТЕМА USHO ПО УМОЛЧАНИЮ", intro: "Место для заметок, идей и постоянных перемен.", latest: "Новые публикации", welcome: "Добро пожаловать в мой блог", excerpt: "Этот блог создан с помощью UshoHub. В UshoHub можно редактировать материалы, управлять языками и публиковать их.", read: "Читать далее", empty: "Скоро появятся новые материалы" },
    ar: { ripple: "تموجات", theme: "السمة", eyebrow: "سمة USHO الافتراضية", intro: "مساحة للملاحظات والأفكار وكل ما يستمر في التغير.", latest: "أحدث المنشورات", welcome: "مرحباً بك في مدونتي", excerpt: "تم إنشاء هذه المدونة باستخدام UshoHub. يمكنك تحرير المحتوى وإدارة اللغات والنشر من UshoHub.", read: "قراءة المزيد", empty: "المزيد من المحتوى قريباً" }
  };

  function applyMode(mode) {
    var dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.mode = mode;
    localStorage.setItem("usho-color-mode", mode);
  }

  if (themeButton) {
    themeButton.addEventListener("click", function () {
      var current = root.dataset.mode || "system";
      applyMode(modes[(modes.indexOf(current) + 1) % modes.length]);
    });
  }

  function applyLanguage(locale) {
    var copy = labels[locale] || labels.en;
    root.lang = locale;
    root.dir = locale === "ar" ? "rtl" : "ltr";
    if (rippleLabel) rippleLabel.textContent = copy.ripple;
    if (themeLabel) themeLabel.textContent = copy.theme;
    document.querySelectorAll("[data-i18n]").forEach(function (element) {
      var key = element.getAttribute("data-i18n");
      if (key && copy[key]) element.textContent = copy[key];
    });
    localStorage.setItem("usho-locale", locale);
  }

  if (languageSelect) {
    var savedLocale = localStorage.getItem("usho-locale");
    if (savedLocale && languageSelect.querySelector('option[value="' + savedLocale + '"]')) {
      languageSelect.value = savedLocale;
    }
    applyLanguage(languageSelect.value);
    languageSelect.addEventListener("change", function () { applyLanguage(languageSelect.value); });
  }

  var rippleEnabled = localStorage.getItem("usho-ripple") !== "off";
  if (rippleButton) {
    rippleButton.setAttribute("aria-pressed", String(rippleEnabled));
    rippleButton.addEventListener("click", function () {
      rippleEnabled = !rippleEnabled;
      localStorage.setItem("usho-ripple", rippleEnabled ? "on" : "off");
      rippleButton.setAttribute("aria-pressed", String(rippleEnabled));
      window.dispatchEvent(new CustomEvent("usho:ripple-change", { detail: rippleEnabled }));
    });
  }
})();