JavaScriptでPNGのチャンクを読む（IHDR,PLTE,tRNS）

　まずは簡単そうで優先度の高いチャンクを対象にする。

<!-- more -->

# ブツ

* [DEMO][]
* [リポジトリ][]

[DEMO]:https://ytyaru.github.io/Html.PNG.Decode.Chunk.IHDR.PLTE.tRNS.20221204155322
[リポジトリ]:https://github.com/ytyaru/Html.PNG.Decode.Chunk.IHDR.PLTE.tRNS.20221204155322

```sh
NAME='Html.PNG.Decode.Chunk.IHDR.PLTE.tRNS.20221204155322'
git clone https://github.com/ytyaru/$NAME
cd $NAME/docs
./server.sh
```

1. ターミナルを起動する
1. 上記コマンドを叩く
1. 起動したブラウザでHTTPSを実行する（Chromiumの場合は以下）
	1. `この接続ではプライバシーが保護されません`ページが表示される
	1. `詳細設定`をクリックする
	1. `localhost にアクセスする（安全ではありません）`リンクをクリックする
1. ファイルを選ぶ（次のうちいずれかの方法で）
	* 任意ファイルをドラッグ＆ドロップする
	* ファイル選択ダイアログボタンを押してファイルを選択する
1. PNG判定が実行される
	* もしPNGなら`このファイルはPNG形式です😄`と表示され、PNG画像が表示される
	* もしPNGでないなら`このファイルはPNG形式でない！`と表示される

　テスト用PNG画像はリポジトリの`./docs/asset/image/monar-mark-gold.png`にある。非PNGファイルは適当に`README.md`を使えばいい。

![実行結果例][]

[実行結果例]:memo/eye-catch.png

## 前回まで

* [Html.Canvas.toDataURL.20221129184336][]
* [Html.PNG.Signature.20221202103208][]
* [Html.PNG.Chunk.IHDR.20221202171226][]
* [Html.PNG.Chunk.20221203102217][]

[Html.Canvas.toDataURL.20221129184336]:https://github.com/ytyaru/Html.Canvas.toDataURL.20221129184336
[Html.PNG.Signature.20221202103208]:https://github.com/ytyaru/Html.PNG.Signature.20221202103208
[Html.PNG.Chunk.IHDR.20221202171226]:https://github.com/ytyaru/Html.PNG.Chunk.IHDR.20221202171226
[Html.PNG.Chunk.20221203102217]:https://github.com/ytyaru/Html.PNG.Chunk.20221203102217

# 目標

* [png-file-chunk-inspector][]

[png-file-chunk-inspector]:https://www.nayuki.io/page/png-file-chunk-inspector

　上記のようにPNGファイルのチャンクを読みたい。今回はチャンクの共通部分を読む。

　`IDAT`も解析したいが、zlib圧縮を解析せねばならないため後回し。

# 概要

　PNGファイルは先頭が[シグネチャ][]ではじまり、以降はすべて[チャンク][]とよばれる形式のバイナリデータになる。

* [シグネチャ][]
* [チャンク][]

[PNGファイルシグネチャ]:https://www.w3.org/TR/png/#5PNG-file-signature
[チャンクのレイアウト]:https://www.w3.org/TR/png/#5Chunk-layout

サイズ|データ種別|値の例
------|----------|------
8|PNGファイルシグネチャ|`89 50 4E 47 0D 0A 1A 0A`
N|チャンク|`...`
N|チャンク|`...`
N|チャンク|`...`

　チャンクは必ず次のようなバイナリ配列である。

種類|サイズ|意味
----|------|----
length|4|このチャンクのデータ長
type|4|チャンク種別（ASCII4字）
data|N|チャンクのデータ
[CRC][]|4|データ破損チェック用（`type`と`data`から算出する）

　チャンクにはいくつかの種類があり、それぞれ`type`に固有の識別名がASCIIコードで入る。`data`部分は可変であり、ここにそのチャンク固有のデータが入る。各チャンクについては[チャンク一覧][]を参照。

[チャンク一覧]:https://www.w3.org/TR/png/#4Concepts.FormatTypes
[CRC]:https://ja.wikipedia.org/wiki/%E5%B7%A1%E5%9B%9E%E5%86%97%E9%95%B7%E6%A4%9C%E6%9F%BB

　このうち必須チャンクは`IHDR`,`IDAT`,`IEND`。つまりPNGファイルは次のような順のバイナリ配列となる。

byte|データ
----|------
8|シグネチャ
25|`IHDR`
N|`IDAT`
12|`IEND`

　他にもドット絵などでインデックスカラーを使うなら`PLTE`, `tRNS`といったチャンクがある。各チャンクは順序がある程度指定されており、以下のような順になる。

1. シグネチャ
1. `IHDR`
1. `PLTE`
1. `tRNS`
1. `IDAT`
1. `IEND`

## `IHDR`

種類|サイズ|値
----|------|---
length|4|`13`
type|4|`49 48 44 52`
width|4|`1`〜
height|4|`1`〜
bitDepth|1|`1`,`2`,`4`,`8`,`16`
colorType|1|`0`,`2`,`3`,`4`,`6`
compressionMethod|1|`0`
filterMethod|1|`0`
interlaceMethod|1|`0`,`1`
[CRC][]|4|チェックサム計算値

　`colorType`と`bitDepth`の対応表は以下。

`colorType`|`bitDepth`|意味
-----------|----------|----
`0`|`1`,`2`,`4`,`8`,`16`|グレースケール
`2`|`8`,`16`|トゥルーカラー
`3`|`1`,`2`,`4`,`8`|インデックスカラー
`4`|`8`,`16`|グレースケール＋αチャンネル
`6`|`8`,`16`|トゥルーカラー＋αチャンネル

## `PLET`

種類|サイズ|値
----|------|---
length|4|`0`
type|4|`50 4C 54 45`（`80 76 84 69`）
0-R|1|`00`
0-G|1|`00`
0-B|1|`00`
N-R|1|`00`
N-G|1|`00`
N-B|1|`00`
[CRC][]|4|計算値

　0番目のパレットから順に色をセットしていく。色はRGBの3要素あり、それぞれ1バイトで表現する。

　もし`IHDR`の`colorType`が`3`で`bitDepth`が`8`なら、256色ある。ただしそれより少ない色数のデータであってもよい。色はRGBという3つの要素で表す。`0-R`が0番目のR、`0-G`が0番目のG、`0-B`が0番目のB。以降は同様に1番目の色、2番目の色とつづく。

* [PLTE][]

[PLTE]:https://www.w3.org/TR/png/#11PLTE

## `tRNS`

種類|サイズ|値
----|------|---
length|4|`0`
type|4|`74 52 4E 53`（116 82 78 83）
0-A|1|`00`
N-A|1|`00`
[CRC][]|4|計算値

　0番目のパレットに対して順に透明度をセットしていく。1バイトで表現する。

　`0-A`はパレット0番目の色に対する透明度。`00`は完全透明であり、`FF`は完全不透明。

　`0-A`から順に`1-A`,`2-A`となり、最大で`2**IHDR.bitDepth`数だけ作成できる。8bitなら256個。

　ふつうは`0`番目のパレットだけを完全透明にする使い方をする。これにより背景1色だけを完全透明にした画像が作れる。全ピクセルに透明度をもたせる方式よりもはるかに少ないデータ量で実現できる。

　半透明を用意することもできる。ただし`tRNS`の仕様上、透明度があるパレット色を連番にすることで必要最小限のサイズにできることに注意する。もし飛び飛びのパレット番号に設定する必要があるなら、透明度が必要な最後のパレット番号までのサイズが必要になる。今回もちいた[テスト用PNG画像ファイル][]でも、全20色のうち先頭から10色の`0`〜`9`番までが透明色データをもった構造になっている。

[テスト用PNG画像ファイル]:https://github.com/ytyaru/Html.PNG.Signature.20221202103208/blob/master/docs/asset/image/monar-mark-gold.png?raw=true

## `IDAT`

種類|サイズ|値
----|------|--
length|4|`0`
type|4|`49 45 4E 44`
data|N|`FF`...
[CRC][]|4|計算値

　画像データ。zlibのDeflate圧縮されたデータが入っている。今回は対象外。

## `IEND`

種類|サイズ|値
----|------|--
length|4|`0`
type|4|`49 45 4E 44`
[CRC][]|4|計算値

　`IEND`はデータがない。

# コード

　長いので省略。概要だけ書くと以下の2つ。

* PNGのデコード（[png.js][]）
* デコードしたバイナリデータをHTML表示する（[drop-box.js][]）

[png.js]:
[drop-box.js]:

　次のように呼出して使う。

```javascript
const png = new PNG()
try { await png.load(file) }
catch(e) {}
const chunks = png.decode()
```

　`decode()`の結果は`Chunk`インスタンスの配列である。このデータをもちいて画像情報をHTMLに表示している。

　各チャンクのデータをプロパティ名で参照できる。たとえばチャンク共通のプロパティ`length`, `type`, `crc`がある。ほか、各チャンク独自のデータがある。今回実装したのは次の通り。

* 全チャンク共通
	* `length `
	* `type `
	* `crc`
* `IHDR`
	* `width`
	* `height`
	* `bitDepth`
	* `colorType`
	* `compressionMethod`
	* `filterMethod`
	* `interlaceMethod`
* `PLTE`
	* `palette`
* `tRNS`
	* `alphas`

　`PNG`のインタフェースは以下。

```javascript
class PNG {
    async load(file)
    decode()
}
class Signature() {
    isValid()
}
class Chunk {
    static decode(dataView)
    decode(dataView, offset)
    #decodeData(dataView, offset)
    #decodeIHDR(dataView, offset)
    #decodeIDAT(dataView, offset)
    #decodePLET(dataView, offset)
    #decodeTRNS(dataView, offset, colorType=3)
}
```

　大雑把にいうと次のように処理している。

1. [Drag and Drop API][]や[input type="file" 要素][]で取得されたファイルオブジェクト[File][]を渡す
1. 1から[ArrayBafferを取得する][arrayBuffer()]
1. 2から[DataView][]を取得する
1. 3から[PNG仕様][]に沿ってバイナリデータを取得する
1. 4を[クラス][Class]のインスタンス変数としてセットする
1. 5を全チャンクだけ繰り返して配列として返す

[PNG仕様]:https://www.w3.org/TR/png/
[script要素]:https://developer.mozilla.org/ja/docs/Web/HTML/Element/script

[Drag and Drop API]:https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop
[input type="file" 要素]:https://developer.mozilla.org/ja/docs/Web/HTML/Element/input/file
[File]:https://developer.mozilla.org/ja/docs/Web/API/File
[Blob]:https://developer.mozilla.org/ja/docs/Web/API/Blob
[arrayBuffer()]:https://developer.mozilla.org/ja/docs/Web/API/Blob/arrayBuffer

[JavaScript の型付き配列]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Typed_arrays
[TypedArray]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Typed_arrays
[ArrayBuffer]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer
[DataView]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/DataView
[Int8Array]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Int8Array
[Uint8Array]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array
[Uint8ClampedArray]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Uint8ClampedArray
[Int16Array]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Int16Array
[Uint16Array]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Uint16Array
[Int32Array]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Int32Array
[Uint32Array]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Uint32Array
[Float32Array]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Float32Array
[Float64Array]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Float64Array
[BigInt64Array]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/BigInt64Array
[BigUint64Array]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/BigUint64Array
[等価性の比較と同一性]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Equality_comparisons_and_sameness
[DataView]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/DataView

[TextDecoder]:https://developer.mozilla.org/ja/docs/Web/API/TextDecoder
[Reflect]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Reflect
[Class]:https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Classes

<!--

* 複数パレット所持
* パレット切替
* パレットアニメ
* スプライトシート（テクスチャアトラス）
	* フレーム幅（`width`）
	* フレーム高さ（`height`）
	* フレーム数（フレーム数ビット深度 `1`,`2`,`3`,`4`）
	* フレームリスト

[TexturePackerを自作した]:https://tyfkda.github.io/blog/2013/10/05/texture-pakcer.html
[Canvas から生成した PNG 画像に独自の情報を埋め込む]:https://labs.gree.jp/blog/2013/12/8594/

* [Canvas から生成した PNG 画像に独自の情報を埋め込む][]

プライベートチャンク

SubPalette: spLT
Palette-A: plTA
Palette-B: plTB
Palette-C: plTC
...
Palette-Z: plTZ

Transparent: tRNS
Transparent-A: trSA
Transparent-Z: trSZ

[RPGツクールMV・MZでベストなキャラサイズを探る]:https://zenn.dev/tonbi/articles/4baa9b9f260284

* [RPGツクールMV・MZでベストなキャラサイズを探る][]

-->

