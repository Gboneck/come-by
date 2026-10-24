const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
canvas.width = 240;
canvas.height = 240;
ctx.fillStyle = '#A3AD6E';
ctx.fillRect(0, 0, 240, 240);
