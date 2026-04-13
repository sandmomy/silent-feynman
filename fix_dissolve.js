const fs = require('fs');
const path = 'C:/Users/Usuario/Downloads/about-particle-landing.html';

console.log("Reading file from: " + path);
let content = fs.readFileSync(path, 'utf8');

// We need to replace the chaos logic and the size update logic.
// Target Block: "const chaosIntensity = (currentIdx === 0) ? 0.0 : 6.0;" (or whatever it is now)
// We want to replace it with 15.0 intensity.

const chaosRegex = /const chaosIntensity\s*=\s*\(currentIdx\s*===\s*0\)\s*\?\s*0\.0\s*:\s*\d+(\.\d+)?;/;

if (chaosRegex.test(content)) {
    console.log("Found chaos intensity line. Updating to 15.0...");
    content = content.replace(chaosRegex, 'const chaosIntensity = (currentIdx === 0) ? 0.0 : 15.0; // UPDATED: High Dissolve');
} else {
    console.log("Chaos line not found. It might be different.");
}

// Target Block for Size: "sizeBuf[i] = sizeA + (sizeB - sizeA) * easedMix;"
// We want to inject the melting logic before assignment.
const sizeLogicSearch = /sizeBuf\[i\]\s*=\s*sizeA\s*\+\s*\(sizeB\s*-\s*sizeA\)\s*\*\s*easedMix;/;
const sizeLogicReplace = `
                    // Interpolar tamaños CON EFECTO MELT/DISSOLVE
                    const rawSize = sizeA + (sizeB - sizeA) * easedMix;
                    
                    // Al momento de la explosión (chaosCurve alto), reducimos el tamaño
                    // para que parezca que las partículas se desintegran en polvo
                    const sizeMelt = (currentIdx === 0) ? 0.0 : (chaosCurve * 3.5); 
                    const targetSize = Math.max(0.1, rawSize - sizeMelt);
                    
                    sizeBuf[i] = targetSize;
`;

if (sizeLogicSearch.test(content)) {
    console.log("Found size assignment. Injecting melt logic...");
    content = content.replace(sizeLogicSearch, sizeLogicReplace);
} else {
    console.log("Size assignment not found.");
}

fs.writeFileSync(path, content, 'utf8');
console.log("Done.");
