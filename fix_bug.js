const fs = require('fs');
const path = 'C:/Users/Usuario/Downloads/about-particle-landing.html';

console.log("Reading file from: " + path);
let content = fs.readFileSync(path, 'utf8');

// 1. Remove the broken inner function block
// The block starts with '// FUNCTION MOVED TO GLOBAL SCOPE' and ends with a closing brace line
// But it has line breaks, so we need safe regex
// We know it contains 'return { r: ... }'
const signature = '// FUNCTION MOVED TO GLOBAL SCOPE';
const endSignature = 'b: b * (1 - mixGold) + 0.2 * mixGold';

if (content.indexOf(signature) !== -1) {
    console.log("Found start signature.");
    const startIndex = content.indexOf(signature);

    // Find the end of the block (it ends a few lines after endSignature)
    const endBodyIndex = content.indexOf(endSignature, startIndex);
    if (endBodyIndex !== -1) {
        // Find the closing brace of the function (approx 2 lines down)
        // Or we can just slice until we see '}' followed by newline and indent
        const closingBraceIndex = content.indexOf('};', endBodyIndex);
        // Actually it returns object so '};' closes return, then '}' closes function
        const funcCloseIndex = content.indexOf('}', closingBraceIndex + 5);

        if (funcCloseIndex !== -1) {
            console.log("Found end of broken block. Deleting...");
            const toRemove = content.substring(startIndex, funcCloseIndex + 1);
            // console.log("Removing:\n", toRemove);
            content = content.replace(toRemove, '');
        } else {
            console.log("Could not find function closing brace.");
        }
    } else {
        console.log("Could not find end signature.");
        // Try fallback regex
        const regex = /\/\/ FUNCTION MOVED TO GLOBAL SCOPE[\s\S]*?mixGold\s*\}\s*;\s*\}/;
        if (regex.test(content)) {
            console.log("Regex matched! Deleting...");
            content = content.replace(regex, '');
        }
    }
} else {
    console.log("Start signature not found. Checking if already cleaned...");
}


// 2. Add Global Function
// Avoid duplicate adding
if (content.indexOf('function calculateSymbolColor(idx, i, y, seed, time)') === -1) {
    console.log("Adding global function...");
    const globalFunc = `
            // ============================================
            // HELPER: Calculate Color Logic (Global Optimized)
            // ============================================
            function calculateSymbolColor(idx, i, y, seed, time) {
                const sColors = symbolColors[idx] || [];
                const sSubTypes = symbolSubTypes[idx];
                const sSubType = sSubTypes ? sSubTypes[i] : null;
                
                // Default to explicit color if subType logic isn't applicable
                if (!sSubType && sColors[i]) return new THREE.Color(sColors[i]); // fallback
                if (sColors[i] === 'gold' && !sSubType) {
                        // Default gold fallback
                        return goldColors.medium;
                }

                // Structure vs Energy Logic
                if (sSubType === 'edge') return goldColors.medium;
                if (sSubType === 'vertex') return goldColors.bright;
                
                // Vibrant Energy
                const hNorm = (y + 10) / 20;
                const hue = (hNorm * 0.8 + time * 0.05) % 1.0;
                const r = Math.sin(hue * 6.28 + 0) * 0.5 + 0.5;
                const g = Math.sin(hue * 6.28 + 2.09) * 0.5 + 0.5;
                const b = Math.sin(hue * 6.28 + 4.18) * 0.5 + 0.5;
                const mixGold = 0.3;
                return {
                    r: r * (1 - mixGold) + 1.0 * mixGold,
                    g: g * (1 - mixGold) + 0.8 * mixGold,
                    b: b * (1 - mixGold) + 0.2 * mixGold
                };
            }
`;
    // Insert before SCROLL ANIMATION
    const anchor = '// SCROLL ANIMATION';
    if (content.includes(anchor)) {
        content = content.replace(anchor, globalFunc + '\n' + anchor);
    } else {
        console.log("Anchor not found for global function!");
    }
} else {
    console.log("Global function already exists.");
}

fs.writeFileSync(path, content, 'utf8');
console.log("Done.");
