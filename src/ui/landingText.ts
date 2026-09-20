export type Lang = 'ru' | 'en';

export interface LandingText {
  nav: { about: string; features: string; architecture: string; stack: string; open: string };
  hero: {
    title: string;
    lead: string;
    start: string;
    how: string;
    caption: string;
    noGl: string;
    facts: [string, string][];
  };
  about: { title: string; paragraphs: string[]; tryTitle: string; steps: string[] };
  features: { title: string; items: { title: string; text: string }[] };
  architecture: { title: string; lead: string; items: { title: string; text: string }[] };
  diagram: {
    label: string;
    ui: [string, string];
    editor: [string, string];
    collab: [string, string];
    model: [string, string];
    plan: [string, string];
    scene: [string, string];
    data: [string, string];
    commands: string;
    events: string;
    ops: string;
  };
  stack: { title: string; head: [string, string, string]; rows: [string, string, string][] };
  roadmap: { title: string; lead: string; items: string[]; cta: string; source: string; author: string };
}

export const TEXT: Record<Lang, LandingText> = {
  ru: {
    nav: {
      about: 'О проекте',
      features: 'Возможности',
      architecture: 'Архитектура',
      stack: 'Технологии',
      open: 'Открыть редактор',
    },
    hero: {
      title: 'Проектируйте пространство. Смотрите в 3D.',
      lead: 'SpaceForge — интерактивный редактор планировки в браузере. Рисуйте стены на 2D-плане, расставляйте мебель и сразу смотрите ту же комнату в 3D. Это портфолио-проект: небольшой, но законченный продукт с историей изменений, сохранением и совместной работой.',
      start: 'Открыть редактор',
      how: 'Как это устроено',
      caption: 'Одна квартира и одна модель данных: план слева внизу, 3D на заднем плане.',
      noGl: '3D-превью требует WebGL. 2D-план в редакторе работает и без него.',
      facts: [
        ['Язык', 'TypeScript, strict'],
        ['3D', 'Three.js на WebGL2'],
        ['План', 'Canvas 2D'],
        ['Состояние', 'Zustand и история команд'],
        ['Синхронизация', 'WebSocket или вкладки'],
        ['Тесты', 'Jest'],
      ],
    },
    about: {
      title: 'О проекте',
      paragraphs: [
        'SpaceForge — браузерный редактор планировки: небольшой конструктор интерьера, написанный с нуля.',
        'Цель проекта — показать не один эффект, а весь путь инженерной задачи: геометрию и 3D-графику, единую модель данных, историю изменений, сохранение, совместное редактирование и заботу о производительности.',
        'Всё работает в браузере, без сервера. Сервер нужен только для необязательной совместной работы по WebSocket.',
      ],
      tryTitle: 'Попробуйте за минуту',
      steps: [
        'Нажмите «Открыть редактор»: там уже есть двухкомнатная квартира.',
        'Выберите инструмент «Room» и обведите на плане прямоугольник. Появятся четыре стены и пол.',
        'Перетащите «Sofa» или «Bed» из каталога в комнату: у стены мебель развернётся сама.',
        'Переключитесь на «3D» или «Split» и покрутите камеру. Стены между вами и комнатой опускаются автоматически.',
        'Выберите предмет в 3D и потяните за стрелки. Нажмите Ctrl+Z, и действие отменится.',
        'Откройте вторую вкладку с редактором и нажмите «Sync tabs» в обеих: правки появятся в обеих.',
      ],
    },
    features: {
      title: 'Возможности',
      items: [
        {
          title: '2D-редактор',
          text: 'Стены, комнаты, двери и окна с привязкой к сетке и к углам. Живые размеры, измерение расстояний, ручки для поворота и изменения размера.',
        },
        {
          title: '3D-сцена',
          text: 'Стены с настоящими проёмами, полы из разных материалов, тени, день и ночь. Орбитальная камера и манипуляторы перемещения, поворота и масштаба.',
        },
        {
          title: 'Мебель',
          text: 'Каталог с перетаскиванием и в план, и прямо в 3D. Мебель прижимается к стене и разворачивается к ней спиной.',
        },
        {
          title: 'История изменений',
          text: 'Любое действие можно отменить и повторить. Перетаскивание — один шаг, быстрые правки одного числа склеиваются.',
        },
        {
          title: 'Совместная работа',
          text: 'Присутствие, лента активности и синхронизация через WebSocket или между вкладками. Для демонстрации есть «виртуальный коллега».',
        },
        {
          title: 'Производительность',
          text: 'Общие геометрии и материалы, ленивая пересборка стен, скрытый вид не рендерится. В строке состояния видны число объектов, вершин и FPS.',
        },
        {
          title: 'Сохранение',
          text: 'Автосохранение в браузере, именованные проекты, экспорт и импорт в JSON.',
        },
        {
          title: 'Тесты',
          text: 'Jest-тесты на геометрию, модель, историю, привязку к стенам и синхронизацию двух клиентов.',
        },
      ],
    },
    architecture: {
      title: 'Архитектура',
      lead: 'Главная идея: один источник данных и несколько его отображений.',
      items: [
        {
          title: 'Одна модель — два вида',
          text: 'План и 3D-сцена не знают друг о друге. Оба читают единую модель сцены и перерисовываются, когда она сообщает об изменении.',
        },
        {
          title: 'Команды',
          text: 'Каждое изменение — команда, которую можно применить и откатить. На этом держатся отмена и повтор, одинаково для перетаскивания и для ввода числа.',
        },
        {
          title: 'Документ и интерфейс отдельно',
          text: 'Сцена живёт в классах с собственной историей и сериализацией. В Zustand лежит только состояние интерфейса: инструмент, режим, освещение.',
        },
        {
          title: 'Свои и чужие правки',
          text: 'Чужие изменения приходят тем же видом обновлений, но помечены как удалённые. Они не пересылаются обратно и не попадают в вашу историю отмены.',
        },
      ],
    },
    diagram: {
      label:
        'Схема: интерфейс отправляет команды редактору, тот меняет модель сцены. 2D-план, 3D-сцена, совместная работа и хранение читают данные из модели.',
      ui: ['Интерфейс', 'React: панели, каталог'],
      editor: ['Редактор', 'Команды, история, выбор'],
      collab: ['Совместная работа', 'Присутствие, чужие правки'],
      model: ['Модель сцены', 'Стены, комнаты, двери, окна, мебель. Единый источник данных с шиной событий.'],
      plan: ['2D-план', 'Canvas 2D'],
      scene: ['3D-сцена', 'Three.js, WebGL2'],
      data: ['Данные и сеть', 'localStorage, WebSocket'],
      commands: 'команды',
      events: 'события изменений',
      ops: 'операции и JSON',
    },
    stack: {
      title: 'Технологии',
      head: ['Область', 'Инструмент', 'Зачем'],
      rows: [
        ['Язык', 'TypeScript (strict)', 'Типы для модели, команд и событий'],
        ['3D', 'Three.js, WebGL2', 'Сцена, камера, свет, Raycaster, TransformControls'],
        ['2D', 'Canvas 2D', 'Собственный рендер плана и выбор объектов, без библиотек'],
        ['Интерфейс', 'React 19', 'Панели и формы. Движок от React не зависит'],
        ['Состояние', 'Zustand', 'Инструмент, режим, освещение. Документ живёт в классах'],
        ['Тесты', 'Jest', 'Геометрия, модель, история, привязка, синхронизация'],
        ['Сборка', 'Vite, ESLint, Prettier', 'Быстрый запуск и единый стиль кода'],
        [
          'Развёртывание',
          'Docker, nginx, Node.js',
          'Dockerfile и compose подготовлены; WebSocket-сервер на Node.js',
        ],
      ],
    },
    roadmap: {
      title: 'Границы проекта и планы',
      lead: 'Проект намеренно небольшой. Вот что в нём пока не сделано:',
      items: [
        'Реальные 3D-модели. Загрузчик GLB готов, но мебель пока собрана из простых форм.',
        'Пол произвольной формы. Нужен поиск замкнутого контура стен, пока комнаты прямоугольные.',
        'Столкновения между предметами и выбор нескольких объектов сразу.',
        'Вход пользователей, отдельные комнаты для совместной работы и хранение проектов на сервере.',
        'Перевод интерфейса самого редактора: он пока на английском.',
      ],
      cta: 'Начните с готовой квартиры: её можно разобрать и собрать заново.',
      source: 'Исходный код',
      author: 'Автор',
    },
  },

  en: {
    nav: {
      about: 'About',
      features: 'Features',
      architecture: 'Architecture',
      stack: 'Stack',
      open: 'Open the editor',
    },
    hero: {
      title: 'Design your space. See it in 3D.',
      lead: 'SpaceForge is an interactive floor-plan editor that runs in the browser. Draw walls on a 2D plan, place furniture, and see the same room in 3D. It is a portfolio project: small, but a complete product with undo history, saving and live collaboration.',
      start: 'Open the editor',
      how: 'How it works',
      caption: 'One apartment, one data model: the plan at the bottom left, 3D behind it.',
      noGl: 'The 3D preview needs WebGL. The editor’s 2D plan works without it.',
      facts: [
        ['Language', 'TypeScript, strict'],
        ['3D', 'Three.js on WebGL2'],
        ['2D plan', 'Canvas 2D'],
        ['State', 'Zustand and a command history'],
        ['Live sync', 'WebSocket or browser tabs'],
        ['Tests', 'Jest'],
      ],
    },
    about: {
      title: 'About the project',
      paragraphs: [
        'SpaceForge is a browser-based floor-plan editor: a small interior planner written from scratch.',
        'The goal is to show the whole path of an engineering problem rather than a single effect: geometry and 3D graphics, one data model, change history, saving, collaborative editing and attention to performance.',
        'Everything runs in the browser without a server. A server is only needed for the optional WebSocket collaboration.',
      ],
      tryTitle: 'Try it in a minute',
      steps: [
        'Click “Open the editor”. A two-room apartment is already there.',
        'Pick the “Room” tool and drag a rectangle on the plan. Four walls and a floor appear.',
        'Drag “Sofa” or “Bed” from the catalog into a room: next to a wall the furniture turns by itself.',
        'Switch to “3D” or “Split” and orbit the camera. Walls between you and the room lower automatically.',
        'Select an object in 3D and pull its arrows. Press Ctrl+Z and the action is undone.',
        'Open a second tab with the editor and click “Sync tabs” in both: edits appear in each.',
      ],
    },
    features: {
      title: 'Features',
      items: [
        {
          title: '2D editor',
          text: 'Walls, rooms, doors and windows with grid and corner snapping. Live dimensions, a measuring tool, and handles for rotating and resizing.',
        },
        {
          title: '3D scene',
          text: 'Walls with real openings, floors in different materials, shadows, day and night. An orbit camera with move, rotate and scale handles.',
        },
        {
          title: 'Furniture',
          text: 'A catalog you can drag into the plan or straight into 3D. Furniture snaps flush to a wall and turns its back to it.',
        },
        {
          title: 'Change history',
          text: 'Every action can be undone and redone. A drag is one step, and quick edits of a single number merge together.',
        },
        {
          title: 'Collaboration',
          text: 'Presence, an activity feed, and sync over a WebSocket or between browser tabs. A built-in “virtual teammate” makes it easy to demo.',
        },
        {
          title: 'Performance',
          text: 'Shared geometry and materials, lazy wall rebuilds, and hidden views stop rendering. The status bar shows objects, vertices and FPS.',
        },
        { title: 'Saving', text: 'Autosave in the browser, named projects, and JSON export and import.' },
        {
          title: 'Tests',
          text: 'Jest tests cover geometry, the model, history, wall snapping and syncing two clients.',
        },
      ],
    },
    architecture: {
      title: 'Architecture',
      lead: 'The main idea: one source of data and several views of it.',
      items: [
        {
          title: 'One model, two views',
          text: 'The plan and the 3D scene know nothing about each other. Both read a single scene model and redraw when it announces a change.',
        },
        {
          title: 'Commands',
          text: 'Every edit is a command that can be applied and reverted. Undo and redo rest on this, equally for a drag and for a typed number.',
        },
        {
          title: 'Document and UI kept apart',
          text: 'The scene lives in classes with its own history and serialisation. Zustand only holds interface state: tool, layout, lighting.',
        },
        {
          title: 'Local and remote edits',
          text: 'Changes from others arrive as the same kind of update but are tagged as remote. They are never sent back and never enter your undo history.',
        },
      ],
    },
    diagram: {
      label:
        'Diagram: the UI sends commands to the editor, which changes the scene model. The 2D view, the 3D view, collaboration and storage all read from the model.',
      ui: ['UI', 'React: panels, catalog'],
      editor: ['Editor', 'Commands, history, selection'],
      collab: ['Collaboration', 'Presence, remote edits'],
      model: [
        'Scene model',
        'Walls, rooms, doors, windows, furniture. One source of truth with an event bus.',
      ],
      plan: ['2D plan', 'Canvas 2D'],
      scene: ['3D scene', 'Three.js, WebGL2'],
      data: ['Storage and sync', 'localStorage, WebSocket'],
      commands: 'commands',
      events: 'change events',
      ops: 'ops and JSON',
    },
    stack: {
      title: 'Stack',
      head: ['Area', 'Tool', 'What for'],
      rows: [
        ['Language', 'TypeScript (strict)', 'Types for the model, commands and events'],
        ['3D', 'Three.js, WebGL2', 'Scene, camera, lights, Raycaster, TransformControls'],
        ['2D', 'Canvas 2D', 'A custom plan renderer and hit-testing, no libraries'],
        ['UI', 'React 19', 'Panels and forms. The engine does not depend on React'],
        ['State', 'Zustand', 'Tool, layout, lighting. The document lives in classes'],
        ['Tests', 'Jest', 'Geometry, model, history, snapping, sync'],
        ['Tooling', 'Vite, ESLint, Prettier', 'Fast dev server and one code style'],
        [
          'Deployment',
          'Docker, nginx, Node.js',
          'Dockerfile and compose are prepared; the WebSocket server runs on Node.js',
        ],
      ],
    },
    roadmap: {
      title: 'Scope and next steps',
      lead: 'The project is deliberately small. Here is what it does not do yet:',
      items: [
        'Real 3D models. The GLB loader is ready, but the furniture is still built from simple shapes.',
        'Floors of any shape. That needs closed wall-loop detection; rooms are rectangular for now.',
        'Collisions between objects and selecting several objects at once.',
        'User accounts, separate collaboration rooms and server-side project storage.',
        'A translated editor interface: it is English only for now.',
      ],
      cta: 'Start from the ready-made apartment: you can take it apart and rebuild it.',
      source: 'Source code',
      author: 'Author',
    },
  },
};
