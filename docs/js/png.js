export class PNG {
    async load(blob) {
        this.dataView = new DataView(await blob.arrayBuffer())
        this.signature = new Signature(this.dataView)
        if (! await this.signature.isValid()) { throw new Error(`ファイルはPNG形式でないため読めません。先頭8バイトのシグネチャが不正値です。`) }
        this.chunk = new Chunk(this.dataView)
    }
    decode() { return Chunk.decode(this.dataView) }
}
class Signature {
    constructor(dataView) { this.SIG = [137,80,78,71,13,10,26,10]; this.dataView = dataView; }
    isValid() {
        if (this.dataView.length < this.SIG.length) { return false }
        for (let i=0; i<this.SIG.length; i++) {
            console.log(this.SIG[i], this.dataView.getUint8(i))
            if (this.SIG[i] !== this.dataView.getUint8(i)) { return false }
        }
        console.log(`isPng === true`)
        return true
    }
}
class Chunk {
    static decode(dataView) {
        console.log(dataView)
        const chunks = []
        let isLoop = true
        let offset = 8 // SIG.length 本当は クラス定数にしたい
        while (isLoop) {
            const chunk = new Chunk()
            chunk.decode(dataView, offset)
            chunks.push(chunk)
            if ('IEND'===chunk.type) { break; }
            offset += 12 + chunk.length // 12==length,type,crcの長さ
        }
        console.log(chunks)
        return chunks
    }
    constructor() {
        this.length = 0
        this.type = 0
        this.crc = 0
    }
    decode(dataView, offset) {
        this.length = dataView.getUint32(offset)
        this.type = new TextDecoder('ascii').decode(new Uint8Array([
            dataView.getUint8(offset + 4),
            dataView.getUint8(offset + 5),
            dataView.getUint8(offset + 6),
            dataView.getUint8(offset + 7),
        ]))
        this.#decodeData(dataView, offset + 8)
        this.crc = dataView.getUint32(offset + 8 + this.length)
    }
    #decodeData(dataView, offset) {
        switch(this.type) {
            case 'IHDR': this.#decodeIHDR(dataView, offset); break;
            case 'PLTE': this.#decodePLET(dataView, offset); break;
            case 'tRNS': this.#decodeTRNS(dataView, offset); break;
            case 'IDAT': this.#decodeIDAT(dataView, offset); break;
            case 'IEND':
            default: break;
        }
    }
    #decodeIHDR(dataView, offset) {
        this.width = dataView.getUint32(offset)
        this.height = dataView.getUint32(offset + 4)
        this.bitDepth = dataView.getUint8(offset + 8)
        this.colorType = dataView.getUint8(offset + 9)
        this.compressionMethod = dataView.getUint8(offset + 10)
        this.filterMethod = dataView.getUint8(offset + 11)
        this.interlaceMethod = dataView.getUint8(offset + 12)
    }
    #decodeIDAT(dataView, offset) {
        console.log(`IDAT`)
        this.data = '未実装。zlib圧縮データの解凍とフィルタリング解凍を行う。'
    }
    #decodePLET(dataView, offset) {
        console.log(`PLET`)
        this.palette = new Uint8Array(this.length)
        for (let i=0; i<this.length; i++) { this.palette[i] = dataView.getUint8(offset + i) }
    }
    #decodeTRNS(dataView, offset, colorType=3) {
        console.log(`tRNS`)
        if (0 === this.length % 3) { throw new Error(`tRNSのlengthは3で割り切れる数であるべきです。`) }
        if (0 === colorType) { // グレースケール
            this.alphas = new Uint16Array(this.length)
            for (let i=0; i<this.length; i++) { this.alphas[i] = dataView.getUint8(offset + i) }
        }
        else if (2 === colorType) { // True Color (RGB)
            this.alphas = new Uint16Array(this.length*3)
            for (let i=0; i<this.length*3; i++) { this.alphas[i] = dataView.getUint8(offset + i) }
        }
        else if (3 === colorType) { // Indexed Color
            this.alphas = new Uint8Array(this.length)
            for (let i=0; i<this.length; i++) { this.alphas[i] = dataView.getUint8(offset + i) }
        }
        else if (4 === colorType || 6 === colorType) { // 4,6 は IDAT に alpha値が含まれているため tRNS は不要
            console.log(`colorTypeが4または6のときtRNSは不要です。透明度はIDATに含まれているためです。`)
        }
        else { throw Error(`colorTypeが不正値です。`) }
    }
}

/*
class IHDR extends ChunkData {
    constructor() { super() } // super()必須。本当は省略したいけど無理
    decode(dataView, offset) {
        super.decode(dataView, offset); // super.decode()必須。本当は省略したいけど無理
        this.width = dataView.getUint32(offset)
        this.height = dataView.getUint32(offset + 4)
        this.bitDepth = dataView.getUint8(offset + 8)
        this.colorType = dataView.getUint8(offset + 9)
        this.compressionMethod = dataView.getUint8(offset + 10)
        this.filterMethod = dataView.getUint8(offset + 11)
        this.interlaceMethod = dataView.getUint8(offset + 12)
    }
    encode(dataView, offset) {
        dataView.setUint32(this.width)
        dataView.getUint32(this.height)
        dataView.getUint8(this.bitDepth)
        dataView.getUint8(this.colorType)
        dataView.getUint8(this.compressionMethod)
        dataView.getUint8(this.filterMethod)
        dataView.getUint8(this.interlaceMethod)
    }
}


class Chunk {
    constructor() {
        this.length = 0
        this.type = 0
        this.data = null
        this.crc = 0
    }
    static decode(dataView) {
        const chunks = []
        let isLoop = true
        let offset = 8 // SIG.length 本当は クラス定数にしたい
        while (isLoop) {
            const chunk = Chunk.readCommon(dataView, offset)
            chunks.push(chunk)
            if ('IEND'===chunk[1]) { break; }
            offset += 12 + chunk[0]
        }
        return chunks
    }
    //async encode(dataView) { }
    static readCommon(dataView, offset) {
        const length = dataView.getUint32(offset)
        const type = new TextDecoder('ascii').decode(new Uint8Array([
            dataView.getUint8(offset + 4),
            dataView.getUint8(offset + 5),
            dataView.getUint8(offset + 6),
            dataView.getUint8(offset + 7),
        ]))
        const crc = dataView.getUint32(offset + 8 + length)
        return [length, type, crc]
    }
    static readTypedData(dataView, offset) {
        switch(type) {
            
        }
    }
    static readCommon(dataView, offset) { // 本当はprotectedにしたい
        const chunk = new Chunk()
        this.length = dataView.getUint32(offset)
        this.type = new TextDecoder('ascii').decode(new Uint8Array([
            this.dataView.getUint8(offset + 4),
            this.dataView.getUint8(offset + 5),
            this.dataView.getUint8(offset + 6),
            this.dataView.getUint8(offset + 7),
        ]))
        this.crc = dataView.getUint32(offset + 8 + length)
    }
    read(offset) { // 本当はprotectedにしたい
        const chunk = new Chunk()
        this.length = dataView.getUint32(offset)
        this.type = new TextDecoder('ascii').decode(new Uint8Array([
            this.dataView.getUint8(offset + 4),
            this.dataView.getUint8(offset + 5),
            this.dataView.getUint8(offset + 6),
            this.dataView.getUint8(offset + 7),
        ]))
        this.crc = dataView.getUint32(offset + 8 + length)
    }
}
class IHDR {
    decode(dataView, offset) {
        this.width = dataView.getUint32(offset)
        this.height = dataView.getUint32(offset + 4)
        this.bitDepth = dataView.getUint8(offset + 8)
        this.colorType = dataView.getUint8(offset + 9)
        this.compressionMethod = dataView.getUint8(offset + 10)
        this.filterMethod = dataView.getUint8(offset + 11)
        this.interlaceMethod = dataView.getUint8(offset + 12)
    }
    encode(dataView, offset) {
        dataView.setUint32(this.width)
        dataView.getUint32(this.height)
        dataView.getUint8(this.bitDepth)
        dataView.getUint8(this.colorType)
        dataView.getUint8(this.compressionMethod)
        dataView.getUint8(this.filterMethod)
        dataView.getUint8(this.interlaceMethod)
    }
}

export class PngDecoder { // https://developer.mozilla.org/ja/docs/Web/JavaScript/Typed_arrays
    constructor() { this.SIG = [137,80,78,71,13,10,26,10] }
    async decode(blob) {
        const dataView = new DataView(await blob.arrayBuffer())
        if (! await this.#isPng(dataView)) { throw new Error(`PNG形式でない。先頭8バイトのシグネチャが不正値です。`) }
        return Chunk.read(dataView)
    }
    async #isPng(dataView) { // blob/file PNGファイルシグネチャがあるか
        console.log(`isPngFromDataView`)
        if (dataView.length < this.SIG.length) { return false }
        for (let i=0; i<this.SIG.length; i++) {
            console.log(this.SIG[i], dataView.getUint8(i))
            if (this.SIG[i] !== dataView.getUint8(i)) { return false }
        }
        console.log(`isPng === true`)
        return true
    }
}
class Chunk {
    static read(dataView) {
        const chunks = []
        let isLoop = true
        let offset = 8 // SIG.length
        while (isLoop) {
            const chunk = Chunk.read(dataView, offset)
            chunks.push(chunk)
            if ('IEND'===chunk[1]) { break; }
            offset += 12 + chunk[0]
        }
        return chunks

    }
    static read(dataView, offset) {
        const length = dataView.getUint32(offset)
        const type = new TextDecoder('ascii').decode(new Uint8Array([
            dataView.getUint8(offset + 4),
            dataView.getUint8(offset + 5),
            dataView.getUint8(offset + 6),
            dataView.getUint8(offset + 7),
        ]))
        const crc = dataView.getUint32(offset + 8 + length)
        return [length, type, crc]
    }
    constructor(dataView) { this._dataView = dataView }
    read(offset) {
        this.length = this.dataView.getUint32(offset)
        this.type = new TextDecoder('ascii').decode(new Uint8Array([
            this._dataView.getUint8(SIG_SZ + 4),
            this._dataView.getUint8(SIG_SZ + 5),
            this._dataView.getUint8(SIG_SZ + 6),
            this._dataView.getUint8(SIG_SZ + 7),
        ]))
        this.crc = dataView.getUint32(SIG_SZ + 21)
    }
}
export class IHDR {
    KEYS = ['length', 'type', 'width', 'height', 'bitDepth', 'colorType', 'compressionMethod', 'filterMethod', 'interlaceMethod', 'crc']
    constructor(dataView) {
        const SIG_SZ = 8
        this.length = dataView.getUint32(SIG_SZ)
        this.type = new TextDecoder('ascii').decode(new Uint8Array([
            dataView.getUint8(SIG_SZ + 4),
            dataView.getUint8(SIG_SZ + 5),
            dataView.getUint8(SIG_SZ + 6),
            dataView.getUint8(SIG_SZ + 7),
        ]))
        this.width = dataView.getUint32(SIG_SZ + 8)
        this.height = dataView.getUint32(SIG_SZ + 12)
        this.bitDepth = dataView.getUint8(SIG_SZ + 16)
        this.colorType = dataView.getUint8(SIG_SZ + 17)
        this.compressionMethod = dataView.getUint8(SIG_SZ + 18)
        this.filterMethod = dataView.getUint8(SIG_SZ + 19)
        this.interlaceMethod = dataView.getUint8(SIG_SZ + 20)
        this.crc = dataView.getUint32(SIG_SZ + 21)
    }
    show() {
        for (const prop of this.KEYS) { console.log(`${prop}: ${Reflect.get(this, prop)}`) }
    }
    toHtml() {
        const table = document.createElement('table')
        const caption = document.createElement('caption')
        caption.textContent = this.type
        table.appendChild(caption)
        for (const prop of this.KEYS) {
            const tr = document.createElement('tr')
            const th = document.createElement('th')
            const td = document.createElement('td')
            th.textContent = prop
            td.textContent = Reflect.get(this, prop)
            tr.appendChild(th)
            tr.appendChild(td)
            table.appendChild(tr)
        }
        return table
    }
}
*/

