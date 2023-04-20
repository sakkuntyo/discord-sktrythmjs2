# 音楽を再生してくれる Bot

[招待リンク](https://discord.com/api/oauth2/authorize?client_id=1097470836711100446&permissions=0&scope=bot%20applications.commands)

![Animation](https://user-images.githubusercontent.com/20591351/233257350-2023ecad-c982-433c-a943-93dbf10dc93b.gif)

## 動作環境
- nodejs 18.15
- typescript 5.0.4
- ts-node 10.9.1

## 依存
- discord.js 14.9
- discord-player 6.1.1

## 使い方

### 再生

```
/play keyword: (URL または キーワード)
```

※ ボイスチャンネルのチャット欄で

### ボイスチャンネルから退出

```
/disconnect
```

### 現在のプレイリストを表示

```
/list
```

### プレイリストのシャッフル

```
/shuffle
```

### リピート切り替え

```
/repeat
```

### バージョン

```
/version
```

## Discord Developer 側設定

### OAuth > Url Generator
スラッシュコマンドしか見ないので Read 等は不要
![image](https://user-images.githubusercontent.com/20591351/233255560-ef8e1cd1-0fa3-4762-9b2f-0fd8f57c86c5.png)
