(function (global) {
  'use strict';

  const CogLab = (global.CogLab = global.CogLab || {});

  CogLab.Config = {
    APP_VERSION: '1.0.0',
    TITLE: 'Nền tảng Thực nghiệm Tâm lý Số — VISEF / KHKT THPT',

    MODES: {
      OFFICIAL: {
        id: 'OFFICIAL',
        label: 'Chính thức (Phòng Lab)',
        stroopTrials: 40,
        gonogoTrials: 60,
        twobackTrials: 40,
        practiceTrials: 6,
        breakSec: 20,
        interventionSec: 600
      },
      DEMO: {
        id: 'DEMO',
        label: 'Thử nghiệm / Demo Hội đồng',
        stroopTrials: 8,
        gonogoTrials: 12,
        twobackTrials: 10,
        practiceTrials: 4,
        breakSec: 5,
        interventionSec: 20
      }
    },

    TIMING: {
      stroopFixationMs: 300,
      stroopMaxResponseMs: 2500,
      stroopBlankIsiMs: 1200,
      gonogoStimMs: 500,
      gonogoBlankIsiMs: 1500,
      twobackStimMs: 500,
      twobackBlankIsiMs: 1500,
      practiceFeedbackMs: 850,
      outlierFastMs: 150,
      outlierSlowMs: 2000
    },

    STROOP_COLORS: [
      { id: 'RED', label: 'ĐỎ', hex: '#DC2626', key: 'd', keyLabel: 'D' },
      { id: 'GREEN', label: 'XANH LÁ', hex: '#16A34A', key: 'f', keyLabel: 'F' },
      { id: 'BLUE', label: 'XANH LAM', hex: '#2563EB', key: 'j', keyLabel: 'J' },
      { id: 'YELLOW', label: 'VÀNG', hex: '#CA8A04', key: 'k', keyLabel: 'K' }
    ],

    TWOBACK_LETTERS: ['B', 'C', 'D', 'F', 'G', 'H', 'K', 'M', 'P', 'T'],

    GROUPS: {
      1: {
        id: 1,
        code: 'G1_SHORT_VIDEO',
        name: 'Nhóm 1: Thực nghiệm (Video ngắn)',
        shortName: 'Video ngắn',
        description: 'Xem chuỗi video ngắn chuyển cảnh nhanh, cuộn liên tục trên màn hình.'
      },
      2: {
        id: 2,
        code: 'G2_ACTIVE_CONTROL',
        name: 'Nhóm 2: Đối chứng chủ động (Đọc văn bản)',
        shortName: 'Đọc văn bản',
        description: 'Đọc bài báo khoa học phổ thông dài trên cùng màn hình.'
      },
      3: {
        id: 3,
        code: 'G3_PASSIVE_CONTROL',
        name: 'Nhóm 3: Đối chứng thụ động (Nghỉ ngơi)',
        shortName: 'Nghỉ ngơi',
        description: 'Ngồi nghỉ yên tĩnh tại chỗ, không sử dụng thiết bị điện tử.'
      }
    },

    STORAGE_KEYS: {
      SESSIONS: 'coglab_sessions_v1',
      SETTINGS: 'coglab_settings_v1',
      RAND_QUEUE: 'coglab_rand_queue_v1'
    },

    DEFAULT_SETTINGS: {
      mode: 'OFFICIAL',
      forcedGroup: 'AUTO',
      sheetsWebhookUrl: '',
      videoSourceType: 'BUILTIN',
      youtubeIds: [],
      customVideoUrls: [],
      soundEnabled: true
    },

    TARGET_PER_GROUP: 30
  };
})(window);
