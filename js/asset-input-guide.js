(function () {
  'use strict';

  // 備品登録画面の見た目や項目を変えず、編集中の項目だけに入力例を表示する。
  const guides = {
    assetNo: {
      title: '管理番号は入力不要',
      detail: '保存時に KD-0001 のような形式で、自動的に番号が付きます。',
      note: '登録済みの管理番号は変更できません。'
    },
    assetName: {
      title: '備品の名前（必須）',
      detail: '入力例：冷蔵庫／洗濯機／自転車／電子レンジ',
      note: '同じ種類が複数ある場合も、現物1台ずつ登録してください。'
    },
    manufacturer: {
      title: '製造したメーカー',
      detail: '入力例：Panasonic／SHARP／アイリスオーヤマ',
      note: '本体のロゴや銘板を確認します。不明なら空欄でも構いません。'
    },
    purchaseDate: {
      title: '取得した年月日',
      detail: '購入・譲り受けなどで会社が備品を取得した日を選択します。',
      note: '日付が分からない場合は空欄で構いません。'
    },
    acquisitionMethod: {
      title: 'どのように取得したか',
      detail: '入力例：新規購入／中古購入／譲渡',
      note: '分かる範囲で入力してください。'
    },
    purchasePrice: {
      title: '備品1台の取得金額',
      detail: '入力例：25000（25,000円の場合）。「円」やカンマは付けず数字だけ。',
      note: '金額が不明なら空欄で構いません。'
    },
    departmentForm: {
      title: '購入・取得を担当した部署',
      detail: '候補から該当する部署を選択します。',
      note: '使用者の所属部署ではなく、備品を購入した部署です。不明なら「未設定」で構いません。'
    },
    locationForm: {
      title: '現在、備品がある場所',
      detail: '入力例：実習生寮／倉庫／事務所 など、候補から選択します。',
      note: '移動した場合は、その都度ここを更新してください。'
    },
    currentUserId: {
      title: '現在使用している実習生など',
      detail: '使用者がいる場合は一覧から選びます。保管中なら「使用者なし（未割当）」を選択します。',
      note: '候補にない人は「管理」画面の使用者マスタへ登録してください。'
    },
    statusForm: {
      title: '備品の現在の状態',
      detail: '使用中：誰かが使用／未使用：保管・再利用可能／修理中：故障・修理待ち／廃棄：処分済み',
      note: '使用者・保管場所と矛盾しない状態を選択してください。'
    },
    assetPhoto: {
      title: '現物写真①：外観',
      detail: '備品全体の形や状態が分かるように撮影します。',
      note: 'スマホから撮影可能です。画像は1枚10MB以下。個人情報は写さないでください。'
    },
    assetLabelPhoto: {
      title: '現物写真②：ラベル・型番',
      detail: 'メーカー名・型番・製造番号が読める銘板やラベルを撮影します。',
      note: '型番などがない備品は無理に撮影しなくても構いません。1枚10MB以下です。'
    },
    note: {
      title: '特記事項や引継ぎ事項',
      detail: '入力例：取扱説明書あり／付属品欠品／扉に傷あり／故障箇所',
      note: 'ほかの項目に収まらない情報を入力してください。'
    }
  };

  function init() {
    const dialog = document.getElementById('assetDialog');
    const form = document.getElementById('assetForm');
    if (!dialog || !form || form.dataset.inputGuideReady === '1') return;
    form.dataset.inputGuideReady = '1';

    if (!document.getElementById('assetInputGuideStyle')) {
      const style = document.createElement('style');
      style.id = 'assetInputGuideStyle';
      style.textContent =
        '#assetForm .asset-input-guide{' +
          'padding:9px 11px;margin:2px 0 5px;background:#f1f7ff;' +
          'border:1px solid #bbd5f1;border-radius:9px;color:#28435b;' +
          'font-size:12px;font-weight:500;line-height:1.65;overflow-wrap:anywhere;' +
        '}' +
        '#assetForm .asset-input-guide strong{' +
          'display:block;margin-bottom:3px;font-size:12px;font-weight:800;color:#195282;' +
        '}' +
        '#assetForm .asset-input-guide .asset-guide-note{' +
          'display:block;color:#536579;margin-top:3px;' +
        '}';
      document.head.appendChild(style);
    }

    let activeField = null;
    let activeGuide = null;
    let originalDescription = null;

    function hideGuide() {
      if (activeGuide) activeGuide.remove();
      if (activeField) {
        if (originalDescription === null) activeField.removeAttribute('aria-describedby');
        else activeField.setAttribute('aria-describedby', originalDescription);
      }
      activeField = null;
      activeGuide = null;
      originalDescription = null;
    }

    function showGuide(field) {
      const spec = field && guides[field.id];
      if (!spec) {
        hideGuide();
        return;
      }
      if (activeField === field) return;
      hideGuide();

      const label = field.closest('label');
      if (!label || !form.contains(label) || label.closest('.hidden')) return;

      const tip = document.createElement('div');
      tip.className = 'asset-input-guide';
      tip.id = 'asset-input-guide-' + field.id;
      tip.setAttribute('role', 'note');

      const title = document.createElement('strong');
      title.textContent = '入力ガイド｜' + spec.title;
      const description = document.createElement('span');
      description.textContent = spec.detail;
      const note = document.createElement('span');
      note.className = 'asset-guide-note';
      note.textContent = spec.note;
      tip.append(title, description, note);
      field.insertAdjacentElement('afterend', tip);

      originalDescription = field.getAttribute('aria-describedby');
      field.setAttribute('aria-describedby',
        [originalDescription, tip.id].filter(Boolean).join(' '));
      activeField = field;
      activeGuide = tip;
    }

    form.addEventListener('focusin', function (event) {
      const field = event.target;
      if (field && Object.prototype.hasOwnProperty.call(guides, field.id)) {
        showGuide(field);
      } else {
        hideGuide();
      }
    });
    // ファイル選択はブラウザによってフォーカスが移らないためクリックにも対応。
    form.addEventListener('pointerdown', function (event) {
      const field = event.target.closest('input, select, textarea');
      if (field && Object.prototype.hasOwnProperty.call(guides, field.id)) {
        showGuide(field);
      } else if (!event.target.closest('.asset-input-guide')) {
        hideGuide();
      }
    });
    form.addEventListener('focusout', function (event) {
      if (event.target !== activeField) return;
      window.setTimeout(function () {
        if (activeField === event.target && document.activeElement !== activeField) {
          hideGuide();
        }
      }, 0);
    });
    dialog.addEventListener('close', hideGuide);
    form.addEventListener('reset', hideGuide);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
