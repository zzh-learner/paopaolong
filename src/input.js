function getCanvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

export function createPointerInput(canvas, game) {
  function releasePointer(event) {
    if (
      typeof canvas.hasPointerCapture === 'function'
      && canvas.hasPointerCapture(event.pointerId)
    ) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  function handlePointerDown(event) {
    event.preventDefault();
    if (typeof canvas.setPointerCapture === 'function') {
      canvas.setPointerCapture(event.pointerId);
    }
    game.handlePointerDown(getCanvasPoint(canvas, event));
  }

  function handlePointerMove(event) {
    event.preventDefault();
    game.handlePointerMove(getCanvasPoint(canvas, event));
  }

  function handlePointerUp(event) {
    event.preventDefault();
    game.handlePointerUp(getCanvasPoint(canvas, event));
    releasePointer(event);
  }

  function handlePointerCancel(event) {
    event.preventDefault();
    game.handlePointerCancel();
    releasePointer(event);
  }

  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerCancel);

  return () => {
    canvas.removeEventListener('pointerdown', handlePointerDown);
    canvas.removeEventListener('pointermove', handlePointerMove);
    canvas.removeEventListener('pointerup', handlePointerUp);
    canvas.removeEventListener('pointercancel', handlePointerCancel);
  };
}
