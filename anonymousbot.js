(function anonymize() {
    document.querySelectorAll('img').forEach(img => {
        img.style.filter = "blur(10px) grayscale(100%)";
    });

    const names = document.querySelectorAll('[data-name], .sj692e, .YTbYzf'); 
    let nameMap = {};
    let count = 1;

    names.forEach(el => {
        let originalName = el.innerText;
        if (!nameMap[originalName]) {
            nameMap[originalName] = "User " + String.fromCharCode(64 + count);
            count++;
        }
        el.innerText = nameMap[originalName];
    });

    console.log("🕵️ Privacy Mode Active: Names and photos hidden.");
})();
