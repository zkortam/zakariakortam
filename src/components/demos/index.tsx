import type { ComponentType } from 'react'
import { HelioLesson } from './HelioLesson'
import { MessengerSeal } from './MessengerSeal'
import { SpiceLive } from './SpiceLive'
import { RtlTrace } from './RtlTrace'
import { AiroGrid } from './AiroGrid'
import { WingmanReview } from './WingmanReview'

export const DEMOS: Record<string, ComponentType> = {
  helio: HelioLesson,
  'surf-messenger': MessengerSeal,
  'spice-plus-plus': SpiceLive,
  'rtl-plus-plus': RtlTrace,
  airofind: AiroGrid,
  wingman: WingmanReview,
}
