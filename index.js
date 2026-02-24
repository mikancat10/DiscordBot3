const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { OpenAI } = require('openai');
require('dotenv').config();

// Discordクライアントの設定
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers, // 参加通知用
  ],
  partials: [Partials.Channel],
});

// OpenAIの設定 (GPT-4o-miniを使用)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PREFIX = '!'; // コマンドの頭文字

client.once('ready', () => {
  console.log(`${client.user.tag} が起動しました！2026年も正常稼働中です。`);
});

// --- 機能1: サーバー参加通知 ---
client.on('guildMemberAdd', async (member) => {
  const channel = member.guild.systemChannel; // システムメッセージ用チャンネル
  if (!channel) return;
  channel.send(`${member.user.tag} さん、いらっしゃい！ゆっくりしていってね。`);
});

// --- 機能2: メッセージ操作 (会話 & コマンド) ---
client.on('messageCreate', async (message) => {
  if (message.author.bot) return; // Botのメッセージは無視

  // A. メッセージ削除コマンド (!clear 数)
  if (message.content.startsWith(`${PREFIX}clear`)) {
    const args = message.content.split(' ');
    const amount = parseInt(args[1]);

    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply('1から100までの数字を指定してください。');
    }

    await message.channel.bulkDelete(amount + 1, true); // +1はコマンド自身も消すため
    return;
  }

  // B. GPT-4o-mini との会話 (メンションされたら反応)
  if (message.mentions.has(client.user)) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: message.content.replace(/<@!?[0-9]+>/g, "").trim() }],
      });

      message.reply(response.choices[0].message.content);
    } catch (error) {
      console.error(error);
      message.reply("ごめん、ちょっと頭が痛くて返信できないよ。");
    }
  }

  // C. Disboard Bump検知 (簡易版)
  if (message.author.id === '302050872383242240' && message.embeds[0]?.description?.includes('表示順をアップしたよ')) {
    message.channel.send('Bumpを確認したよ！2時間後にまた通知するね。');
    setTimeout(() => {
      message.channel.send('【お知らせ】前回のBumpから2時間経ったよ！ /bump してね！');
    }, 2 * 60 * 60 * 1000); // 2時間後
  }
});

client.login(process.env.DISCORD_TOKEN);

const cron = require('node-cron');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// --- 機能: 毎朝8時に天気とニュースを通知 ---
cron.schedule('0 8 * * *', async () => {
    // 通知を送りたいチャンネルID（自分のサーバーのチャンネルIDに書き換えてください）
    const channel = await client.channels.fetch('YOUR_CHANNEL_ID');
    if (!channel) return;

    // 1. ニュースの取得 (NewsAPIなどを想定)
    let newsText = "【最新ニュース】\n";
    try {
        const newsRes = await fetch(`https://newsapi.org/v2/top-headlines?country=jp&apiKey=${process.env.NEWS_API_KEY}`);
        const newsData = await newsRes.json();
        newsData.articles.slice(0, 3).forEach(art => {
            newsText += `・${art.title} ([リンク](${art.url}))\n`;
        });
    } catch (e) { newsText = "ニュースの取得に失敗しました。"; }

    // 2. 全都道府県の天気 (気象庁APIの例)
    // 47都道府県の代表地点コードをループさせて取得します
    const regionCodes = { "北海道": "016000", "東京": "130000", "大阪": "270000", "福岡": "400000", "沖縄": "471000" }; // ここに47個追加可能
    let weatherText = "【全都道府県の天気】\n";

    for (const [name, code] of Object.entries(regionCodes)) {
        try {
            const res = await fetch(`https://www.jma.go.jp/bosai/forecast/data/forecast/${code}.json`);
            const data = await res.json();
            const forecast = data[0].timeSeries[0].areas[0];
            weatherText += `${name}: ${forecast.weathers[0]}\n`;
        } catch (e) { console.error(`${name}の天気取得失敗`); }
    }

    await channel.send(`${newsText}\n${weatherText}`);
}, {
    timezone: "Asia/Tokyo"
});

const { AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');

// --- 機能: 画像編集 (ウェルカムカード生成) ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!welcome')) return;

    // 1. キャンバスの作成 (横700x縦250)
    const canvas = createCanvas(700, 250);
    const ctx = canvas.getContext('2d');

    try {
        // 2. 背景画像を読み込んで描画 (予め assets/bg.png を用意するか、URLを指定)
        // ここでは仮にURLを指定していますが、ローカルファイルの方が安定します
        const background = await loadImage('https://example.com/your-background.png'); 
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

        // 3. 枠線や装飾（半透明の黒い四角形を重ねて文字を見やすくする）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(20, 20, 660, 210);

        // 4. 文字の描画
        ctx.font = '35px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Welcome to the Server!', 250, 100);

        ctx.font = '45px sans-serif';
        ctx.fillText(message.author.username, 250, 170);

        // 5. ユーザーアイコンを丸く切り抜いて描画
        ctx.beginPath();
        ctx.arc(125, 125, 80, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();

        const avatar = await loadImage(message.author.displayAvatarURL({ extension: 'png' }));
        ctx.drawImage(avatar, 45, 45, 160, 160);

        // 6. 画像をDiscordに送信
        const attachment = new AttachmentBuilder(await canvas.toBuffer(), { name: 'welcome-image.png' });
        message.reply({ files: [attachment] });

    } catch (e) {
        console.error(e);
        message.reply('画像の作成中にエラーが発生したよ。');
    }
});
