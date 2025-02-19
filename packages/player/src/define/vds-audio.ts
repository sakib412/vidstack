import { safelyDefineCustomElement } from '@vidstack/foundation';

import { AudioElement } from '../providers/audio/AudioElement';

safelyDefineCustomElement('vds-audio', AudioElement);

declare global {
  interface HTMLElementTagNameMap {
    'vds-audio': AudioElement;
  }
}
