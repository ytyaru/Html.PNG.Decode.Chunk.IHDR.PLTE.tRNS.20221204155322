import {DropBox} from "./drop-box.js";
window.addEventListener('DOMContentLoaded', async(event) => {
    console.log('DOMContentLoaded!!');
    const dropBox = new DropBox()
    await dropBox.create()
});
window.addEventListener('beforeunload', (event) => {
    console.log('beforeunload!!');
});

