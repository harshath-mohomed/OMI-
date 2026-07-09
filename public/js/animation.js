/** Visual FX Translation Hooks mapping orchestration elements */
export class AnimationEngine {
  animateCardToMat(cardId, seatPosition) {
    // Selection execution hook handles rendering animations
    const cardNode = document.querySelector(`[data-card-id="${cardId}"]`);
    if (cardNode) {
      cardNode.style.opacity = '0';
      setTimeout(() => cardNode.remove(), 300);
    }
  }

  clearMatAnimation() {
    const mat = document.getElementById('trick-mat');
    mat.innerHTML = '';
  }
}