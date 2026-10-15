import { QualityLevel } from './QualityLevel'
import { IdleMode } from './IdleMode'
import { SentenceLinks } from './SentenceLinks'

/** Quiet, site-wide behaviours: device-adaptive quality, idle ambient mode, and links to any sentence. */
export function QuietLayer() {
  return (
    <>
      <QualityLevel />
      <SentenceLinks />
      <IdleMode />
    </>
  )
}
