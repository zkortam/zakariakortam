import type { ComponentType } from 'react'
import { HelioBoard } from './HelioBoard'
import { MessengerSeal } from './MessengerSeal'
import { SpiceLive } from './SpiceLive'
import { RtlTrace } from './RtlTrace'
import { AiroGrid } from './AiroGrid'
import { WingmanReview } from './WingmanReview'

export const DEMOS: Record<string, ComponentType> = {
  helio: HelioBoard,
  'surf-messenger': MessengerSeal,
  'spice-plus-plus': SpiceLive,
  'rtl-plus-plus': RtlTrace,
  airofind: AiroGrid,
  wingman: WingmanReview,
}
