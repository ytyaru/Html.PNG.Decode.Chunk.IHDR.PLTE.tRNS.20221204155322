//import {PngReader,IHDR} from "./png-reader.js";
//import {PngDecoder} from "./png-decoder.js";
import {PNG} from "./png.js";
export class DropBox {
    constructor() {}
    async create() {
        var dropZone = document.getElementById('drop-zone');
        var preview = document.getElementById('preview');
        var fileInput = document.getElementById('file-input');
        var apiSelect = document.getElementById('api');

        dropZone.addEventListener('dragover', async(e)=>{
            e.stopPropagation();
            e.preventDefault();
            e.target.style.background = '#e1e7f0';
        }, false);

        dropZone.addEventListener('dragleave', async(e)=>{
            e.stopPropagation();
            e.preventDefault();
            e.target.style.background = '#ffffff';
        }, false);

        fileInput.addEventListener('change', async(e)=>{
            await previewFile(e.target.files[0]);
        });

        dropZone.addEventListener('drop', async(e)=>{
            e.stopPropagation();
            e.preventDefault();
            e.target.style.background = '#ffffff';
            var files = e.dataTransfer.files;
            if (files.length > 1) { return alert('開けるファイルは1つだけです。'); }
            fileInput.files = files;
            await previewFile(files[0]);
        }, false);

        function message(m, isAlert=false) { console.log(m); document.getElementById('is-png').textContent = m; if(isAlert){alert(m)}}
        function makeImage(file) {
            preview.innerHTML = ''
            var fr = new FileReader();
            fr.readAsDataURL(file);
            fr.onload = function() {
                var img = document.createElement('img');
                img.setAttribute('src', fr.result);
                preview.appendChild(img);
            }
        }
        function makeChunkTable(chunks) {
            console.log('チャンク一覧')
            console.log('type', 'length', 'CRC')
            for (const chunk of chunks) {
                console.log(chunk.type, chunk.length, chunk.crc.toString(16))
            }
            const table = document.createElement('table')
            const caption = document.createElement('caption')
            caption.textContent = 'チャンク一覧'
            table.appendChild(caption)
            const tr = document.createElement('tr')
            for (const name of ['length', 'type', 'CRC']) {
                const th = document.createElement('th')
                th.textContent = name
                tr.appendChild(th)
            }
            table.appendChild(tr)
            for (const chunk of chunks) {
                const tr = document.createElement('tr')
                const length = document.createElement('td')
                const type = document.createElement('td')
                const crc = document.createElement('td')
                length.textContent = chunk.length
                type.textContent = chunk.type
                crc.textContent = chunk.crc.toString(16)
                tr.appendChild(length)
                tr.appendChild(type)
                tr.appendChild(crc)
                table.appendChild(tr)
            }
            document.getElementById('chunks').innerHTML = ''
            document.getElementById('chunks').appendChild(table)
            //makeIHDRTable(chunks[0])
            makeIHDRTable(chunks.find((chunk)=>('IHDR'===chunk.type)))
            makePLTETable(chunks.find((chunk)=>('PLTE'===chunk.type)), chunks.find((chunk)=>('tRNS'===chunk.type)))
        }
        function makeIHDRTable(chunk) {
            const keys = ['width', 'height', 'bitDepth', 'colorType', 'compressionMethod', 'filterMethod', 'interlaceMethod']
            document.getElementById('IHDR').innerHTML = ''
            document.getElementById('IHDR').appendChild(makeKvTable(keys, keys.map(key=>Reflect.get(chunk, key)), 'IHDR'))
        }
        function makePLTETable(chunk, trns=null) {
            console.log(`makePLTETable`, chunk.palette, trns)
            if (!chunk) { return }
            const NUM = Math.floor(chunk.length / 3) // パレットの色数
            const MAX_COL_NUM = 16 // 1TRあたりのTD数
            const COL_NUM = (MAX_COL_NUM < NUM) ? MAX_COL_NUM : NUM
            const ROW_NUM = Math.ceil(NUM / COL_NUM)
            console.log(ROW_NUM, COL_NUM, NUM)
            const table = document.createElement('table')
            table.classList.add('checker')
            const caption = document.createElement('caption')
            caption.textContent = 'PLTE' + ((trns) ? ', tRNS' : '')
            table.appendChild(caption)
            for (let r=0; r<ROW_NUM; r++) {
                const tr = document.createElement('tr')
                for (let c=0; c<COL_NUM; c++) {
                    const td = document.createElement('td')
                    const colIdx = (r*COL_NUM) + c
                    if (NUM<=colIdx) { break }
                    td.textContent = colIdx
                    td.width = 16
                    td.height = 9
                    td.setAttribute('style', `padding:0;margin:0;outline:none;border:none;${setTdBgCss(colIdx, chunk, trns)}`)
                    const colCode = colorCode(colIdx, chunk, trns)
                    td.setAttribute('title', colCode)
                    tr.appendChild(td)
                }
                table.appendChild(tr)
            }
            document.getElementById('PLTE').innerHTML = ''
            document.getElementById('PLTE').appendChild(table)
            document.getElementById('PLTE').appendChild(makePLTENumTable(chunk, trns))
        }
        function makePLTENumTable(plte, trns=null) {
            const keys = ['色数']
            const values = [Math.floor(plte.length/3)]
            if (trns && 0 < trns.length) { keys.push('透明色数'); values.push(trns.length); }
            return makeKvTable(keys, values)
        }
        function makeKvTable(keys, values, captionText=null) {
            const table = document.createElement('table')
            if (captionText){
                const caption = document.createElement('caption')
                caption.textContent = 'IHDR'
                table.appendChild(caption)
            }
            for (let i=0; i<keys.length; i++) {
                const tr = document.createElement('tr')
                const th = document.createElement('th')
                const td = document.createElement('td')
                th.textContent = keys[i]
                td.textContent = values[i]
                tr.appendChild(th)
                tr.appendChild(td)
                table.appendChild(tr)
            }
            return table
        }
        function setTdBgCss(colIdx, plte, trns) {
            const P = colIdx * 3
            const R = plte.palette[P+0]
            const G = plte.palette[P+1]
            const B = plte.palette[P+2]
            const rgb = `color:black; background-color:rgb(${R}, ${G}, ${B});`
            if (trns && colIdx < trns.length) {
                const A = trns.alphas[colIdx]
                return rgb + ` opacity:${(0===A) ? 0 : A/255};`
            } else { return rgb }
        }
        function colorCode(colIdx, plte, trns=null) {
            const P = colIdx * 3
            return '#'
                + fig2(plte.palette[P+0])
                + fig2(plte.palette[P+1])
                + fig2(plte.palette[P+2])
                + ((trns && colIdx < trns.length) ? fig2(trns.alphas[colIdx]) : '')
        }
        function fig2(v) { return v.toString(16).padStart(2, '0') }
        async function previewFile(file) {
            try {
                const png = new PNG()
                await png.load(file)
                const chunks = png.decode()
                message(`このファイルはPNG形式です😄`)
                makeImage(file)
                makeChunkTable(chunks)
            }
            catch(e) { message(`このファイルはPNG形式でない！`, true); return; }

            /*
            preview.innerHTML = ''
            document.getElementById('IHDR').innerHTML = ''
            const decoder = new PngDecoder()
            try {
                const chunks = await decoder.decode(file)
                message(`このファイルはPNG形式です😄`)
                console.log('チャンク一覧')
                console.log('type', 'length', 'CRC')
                for (const chunk of chunks) {
                    console.log(chunk[1], chunk[0], chunk[2].toString(16))
                }
            }
            catch(e) { message(`このファイルはPNG形式でない！`, true); return; }

            var fr = new FileReader();
            fr.readAsDataURL(file);
            fr.onload = function() {
                var img = document.createElement('img');
                img.setAttribute('src', fr.result);
                preview.appendChild(img);
            }
            */




            /*
            const ihdr = new IHDR(new DataView(await file.arrayBuffer()))
            ihdr.show()
            document.getElementById('IHDR').appendChild(ihdr.toHtml())
            var fr = new FileReader();
            fr.readAsDataURL(file);
            fr.onload = function() {
                var img = document.createElement('img');
                img.setAttribute('src', fr.result);
                preview.appendChild(img);
            };
            */

            /*
            const reader = new PngReader()
            if (await reader.isPng(file, apiSelect.value)) {
                message(`このファイルはPNG形式です😄`)
                const ihdr = new IHDR(new DataView(await file.arrayBuffer()))
                ihdr.show()
                document.getElementById('IHDR').appendChild(ihdr.toHtml())
                var fr = new FileReader();
                fr.readAsDataURL(file);
                fr.onload = function() {
                    var img = document.createElement('img');
                    img.setAttribute('src', fr.result);
                    preview.appendChild(img);
                };
            }
            else { message(`このファイルはPNG形式でない！`, true) }
            */
        }
    }
}

