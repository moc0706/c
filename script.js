// ゲームデータ構造
let gameState = {
    totalPlayers: 3,
    currentPlayerIndex: 0, // 現在操作中のプレイヤー（0から始まる）
    hands: [],             // 各プレイヤーの手札配列
    log: "ゲームが始まりました"
};

// URLから引き継ぎコードを自動読み込みするためのチェック
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('state');
    if (code) {
        document.getElementById('input-code').value = code;
        loadGame(code);
    }
});

// ペアを捨てる関数
function removePairs(hand) {
    let counts = {};
    hand.forEach(c => counts[c] = (counts[c] || 0) + 1);
    let newHand = [];
    for (let c in counts) {
        if (c === 'Joker') newHand.push('Joker');
        else if (counts[c] % 2 !== 0) newHand.push(Number(c));
    }
    return newHand;
}

// 1. 新しくゲームを開始する
document.getElementById('btn-start').addEventListener('click', () => {
    const count = parseInt(document.getElementById('player-count').value);
    if (count < 2) return alert("2人以上でプレイしてください");

    gameState.totalPlayers = count;
    gameState.currentPlayerIndex = 0;

    // 枚数を人数に合わせて用意（数字1〜7×2 + ジョーカー）
    let deck = [1,1,2,2,3,3,4,4,5,5,6,6,7,7,'Joker'].sort(() => Math.random() - 0.5);
    
    // 手札の分配
    gameState.hands = Array.from({length: count}, () => []);
    deck.forEach((card, idx) => {
        gameState.hands[idx % count].push(card);
    });

    // 最初の一斉ペア捨て
    for (let i = 0; i < count; i++) {
        gameState.hands[i] = removePairs(gameState.hands[i]);
    }

    showGamePanel();
});

// 2. データを読み込んで再開
document.getElementById('btn-load').addEventListener('click', () => {
    const code = document.getElementById('input-code').value.trim();
    loadGame(code);
});

function loadGame(code) {
    try {
        // 圧縮された文字列をデコードして復元
        const decoded = atob(code);
        gameState = JSON.parse(decoded);
        showGamePanel();
    } catch (e) {
        alert("引き継ぎコードが正しくありません。正しくコピーされているか確認してください。");
    }
}

// ゲーム画面の表示と構築
function showGamePanel() {
    document.getElementById('setup-panel').classList.add('hidden');
    document.getElementById('pass-panel').classList.add('hidden');
    document.getElementById('game-panel').classList.remove('hidden');

    const myIdx = gameState.currentPlayerIndex;
    document.getElementById('my-index').textContent = myIdx + 1;
    document.getElementById('turn-title').textContent = `プレイヤー ${myIdx + 1} のターン`;

    // 自分の手札を描画
    const myHandDiv = document.getElementById('my-hand');
    myHandDiv.innerHTML = '';
    const myHand = gameState.hands[myIdx] || [];

    if (myHand.length === 0) {
        myHandDiv.innerHTML = "<p>🎉 あなたの手札は0枚です！アガリ！</p>";
    } else {
        myHand.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card';
            cardEl.textContent = card === 'Joker' ? '🃏' : card;
            myHandDiv.appendChild(cardEl);
        });
    }

    // 引く相手を選ぶボタンを生成（通常は前のプレイヤー、または手札がある人）
    const targetButtonsDiv = document.getElementById('target-buttons');
    targetButtonsDiv.innerHTML = '';
    
    for (let i = 0; i < gameState.totalPlayers; i++) {
        if (i === myIdx) continue; // 自分からは引けない
        
        const count = gameState.hands[i].length;
        if (count === 0) continue; // アガってる人からは引けない

        const btn = document.createElement('button');
        btn.textContent = `プレイヤー ${i + 1} から引く (${count}枚保有)`;
        btn.addEventListener('click', () => showOpponentHand(i));
        targetButtonsDiv.appendChild(btn);
    }

    // もし誰も引く相手がいない（ゲーム終了など）
    if (targetButtonsDiv.children.length === 0) {
        document.getElementById('system-message').textContent = "ゲーム終了、または引ける相手がいません！";
        generatePassCode(true); // 最終結果を回す用
    }
}

// 相手の手札を（裏面で）表示して選ばせる
function showOpponentHand(targetIdx) {
    const oppHandDiv = document.getElementById('opponent-hand');
    oppHandDiv.innerHTML = '';
    oppHandDiv.classList.remove('hidden');

    const targetHand = gameState.hands[targetIdx];
    targetHand.forEach((card, cardIdx) => {
        const cardEl = document.createElement('div');
        cardEl.className = 'card back';
        cardEl.textContent = '？';
        cardEl.addEventListener('click', () => drawCard(targetIdx, cardIdx));
        oppHandDiv.appendChild(cardEl);
    });
}

// カードを引く処理
function drawCard(targetIdx, cardIdx) {
    const myIdx = gameState.currentPlayerIndex;
    
    // カードを移動
    const card = gameState.hands[targetIdx].splice(cardIdx, 1)[0];
    gameState.hands[myIdx].push(card);

    // ペアチェック
    gameState.hands[myIdx] = removePairs(gameState.hands[myIdx]);

    // 次のプレイヤーに手番を回す（手札が残っている次の人を計算）
    let nextIdx = myIdx;
    do {
        nextIdx = (nextIdx + 1) % gameState.totalPlayers;
    } while (gameState.hands[nextIdx].length === 0 && nextIdx !== myIdx);

    gameState.currentPlayerIndex = nextIdx;

    // 次の人へのコード生成画面へ
    generatePassCode(false);
}

// 引き継ぎコード・QRコードの生成
function generatePassCode(isEnd) {
    document.getElementById('game-panel').classList.add('hidden');
    document.getElementById('pass-panel').classList.remove('hidden');

    // データを暗号化文字列（Base64）に変換
    const jsonStr = JSON.stringify(gameState);
    const code = btoa(jsonStr);

    const outputTextarea = document.getElementById('output-code');
    outputTextarea.value = code;

    // 今いるページのURL ＋ データをドッキングした「一発起動URL」を作る
    const baseUrl = window.location.href.split('?')[0];
    const directUrl = `${baseUrl}?state=${code}`;

    // QRコードの生成（直接URLが開くようにする）
    document.getElementById('qrcode').innerHTML = '';
    new QRCode(document.getElementById("qrcode"), {
        text: directUrl,
        width: 128,
        height: 128
    });

    // コピーボタンの設定
    document.getElementById('btn-copy').onclick = () => {
        navigator.clipboard.writeText(directUrl).then(() => {
            alert("次の人が一発で開ける「ゲームURL」をクリップボードにコピーしました！LINEなどで送ってあげてください。");
        }).catch(() => {
            // クリップボードが使えない環境用
            outputTextarea.select();
            alert("枠内のコードをすべてコピーして次の人に送ってください。");
        });
    };
}
