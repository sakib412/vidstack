import {
  debounce,
  type DisconnectCallback,
  discover,
  DisposalBin,
  listen,
  vdsEvent,
} from '@vidstack/foundation';
import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';

import type { MediaVolumeChange, MediaVolumeChangeEvent } from '../events';
import {
  mediaProviderDiscoveryId,
  type MediaProviderElement,
} from '../provider/MediaProviderElement';

const mediaProviders = new Set<MediaProviderElement>();

let syncingMediaPlayback = false;
let syncingMediaVolume = false;

/**
 * This element is responsible for synchronizing elements of the type `MediaProviderElement`.
 *
 * Synchronization includes:
 *
 * - Single media playback (eg: user plays a video while another is already playing, so we pause
 * the newly inactive player).
 *
 * - Synchronized media volume (eg: user sets desired volume to 50% on one player, and they expect
 * it to be consistent across all players).
 *
 * - Saving media volume to local storage (eg: user sets desired to volume 50%, they leave
 * the site, and when they come back they expect it to be 50% without any interaction).
 *
 * @tagname vds-media-sync
 * @slot - Used to pass in content, typically a media player/provider.
 * @events ./media-sync.events.ts
 * @example
 * ```html
 * <vds-media-sync
 *   single-playback
 *   sync-volume
 *   volume-storage-key="@vidstack/volume"
 * >
 *   <!-- ... -->
 * </vds-media-sync>
 * ```
 */
export class MediaSyncElement extends LitElement {
  static override get styles(): CSSResultGroup {
    return css`
      :host {
        display: contents;
      }
    `;
  }

  constructor() {
    super();

    discover(this, mediaProviderDiscoveryId, (provider, onDisconnect) => {
      this._handleMediaProviderConnect(provider as MediaProviderElement, onDisconnect);
    });
  }

  // -------------------------------------------------------------------------------------------
  // Properties
  // -------------------------------------------------------------------------------------------

  /**
   * Whether only one is player should be playing at a time.
   *
   * @defaultValue false
   */
  @property({ type: Boolean, attribute: 'single-playback' })
  singlePlayback = false;

  /**
   * Whether media volume should be in-sync across all media players.
   *
   * @defaultValue false
   */
  @property({ type: Boolean, attribute: 'sync-volume' })
  syncVolume = false;

  /**
   * If a value is provided, volume will be saved to local storage to the given key as it's
   * updated. In addition, when a media provider connects to the manager, it's volume will be
   * set to the saved volume level. If no value is provided, nothing is saved or retrieved.
   *
   * Note that this includes both the volume and muted state.
   *
   * @defaultValue undefined
   */
  @property({ attribute: 'volume-storage-key' })
  volumeStorageKey?: string;

  // -------------------------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------------------------

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._providerDisposal.empty();
  }

  override render() {
    return html`<slot></slot>`;
  }

  // -------------------------------------------------------------------------------------------
  // Media Provider Connect
  // -------------------------------------------------------------------------------------------

  protected _provider?: MediaProviderElement;
  protected _providerDisposal = new DisposalBin();

  get provider() {
    return this._provider;
  }

  protected _handleMediaProviderConnect(
    provider: MediaProviderElement,
    onDisconnect: DisconnectCallback,
  ) {
    this._provider = provider;
    mediaProviders.add(provider);

    const savedVolume = this._getSavedMediaVolume();
    if (savedVolume) {
      this._provider.volume = savedVolume.volume;
      this._provider.muted = savedVolume.muted;
    }

    if (this.singlePlayback) {
      const off = listen(provider, 'vds-play', this._handleMediaPlay.bind(this));
      this._providerDisposal.add(off);
    }

    if (this.syncVolume) {
      const off = listen(
        provider,
        'vds-volume-change',
        debounce(this._handleMediaVolumeChange.bind(this), 10, true),
      );

      this._providerDisposal.add(off);
    }

    if (this.volumeStorageKey) {
      const off = listen(provider, 'vds-volume-change', this._saveMediaVolume.bind(this));

      this._providerDisposal.add(off);
    }

    onDisconnect(() => {
      mediaProviders.delete(provider);
      this._provider = undefined;
      this._providerDisposal.empty();
    });
  }

  // -------------------------------------------------------------------------------------------
  // Playback
  // -------------------------------------------------------------------------------------------

  protected _handleMediaPlay() {
    if (syncingMediaPlayback) return;

    syncingMediaPlayback = true;

    mediaProviders.forEach((provider) => {
      if (provider !== this._provider) {
        provider.paused = true;
      }
    });

    syncingMediaPlayback = false;
  }

  // -------------------------------------------------------------------------------------------
  // Volume
  // -------------------------------------------------------------------------------------------

  protected _handleMediaVolumeChange(event: MediaVolumeChangeEvent) {
    if (syncingMediaVolume) return;
    syncingMediaVolume = true;

    const { volume, muted } = event.detail;

    mediaProviders.forEach((provider) => {
      if (provider !== this._provider) {
        provider.volume = volume;
        provider.muted = muted;
      }
    });

    this.dispatchEvent(
      vdsEvent('vds-media-volume-sync', {
        bubbles: true,
        composed: true,
        detail: event.detail,
      }),
    );

    syncingMediaVolume = false;
  }

  protected _getSavedMediaVolume(): MediaVolumeChange | undefined {
    if (!this.volumeStorageKey) return;

    try {
      return JSON.parse(localStorage.getItem(this.volumeStorageKey)!);
    } catch (e) {
      return undefined;
    }
  }

  protected _saveMediaVolume(event: MediaVolumeChangeEvent) {
    if (!this.volumeStorageKey) return;
    localStorage.setItem(this.volumeStorageKey, JSON.stringify(event.detail));
  }
}
