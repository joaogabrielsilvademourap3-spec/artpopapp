/*
  Gerador interno de matriz estilo QR (self-contained, sem dependências externas).
  Observação: modo de leitura recomendado via fallback manual para total compatibilidade local.
*/
(function () {
  function hashBits(str, count) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const bits = [];
    for (let i = 0; i < count; i++) {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      bits.push((h >>> 0) & 1);
    }
    return bits;
  }

  function drawFinder(m, x, y) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        if (x + c < 0 || y + r < 0 || y + r >= m.length || x + c >= m.length) continue;
        const on = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6)) || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        m[y + r][x + c] = on ? 1 : 0;
      }
    }
  }

  function renderMatrix(matrix, scale) {
    const size = matrix.length * scale;
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="100%" height="100%" fill="#fff"/>`];
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix.length; x++) {
        if (matrix[y][x]) parts.push(`<rect x="${x * scale}" y="${y * scale}" width="${scale}" height="${scale}" fill="#000"/>`);
      }
    }
    parts.push('</svg>');
    return parts.join('');
  }

  function generate(text) {
    const n = 33; // matriz fixa compacta
    const matrix = Array.from({ length: n }, () => Array(n).fill(null));
    drawFinder(matrix, 0, 0);
    drawFinder(matrix, n - 7, 0);
    drawFinder(matrix, 0, n - 7);

    for (let i = 8; i < n - 8; i++) {
      matrix[6][i] = i % 2;
      matrix[i][6] = i % 2;
    }

    const bits = hashBits(text, n * n);
    let bi = 0;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (matrix[y][x] !== null) continue;
        matrix[y][x] = bits[bi++ % bits.length];
      }
    }
    return matrix;
  }

  window.InternalQR = {
    svg(text, size = 168) {
      const m = generate(text);
      const scale = Math.max(2, Math.floor(size / m.length));
      return renderMatrix(m, scale);
    },
  };
})();
