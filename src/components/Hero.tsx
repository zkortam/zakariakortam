'use client'

import { motion } from 'framer-motion'
import { Grid } from './Container'
import { EASE } from './Motion'

/**
 * NDS hero: a plain statement in the right half, the name set large along
 * the floor of the first screen.
 */
export function Hero() {
  return (
    <section className="flex min-h-[100svh] flex-col justify-between pb-10 pt-32 sm:pb-14 lg:pt-[22vh]">
      <Grid>
        <motion.p
          initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1.1, delay: 0.5, ease: EASE }}
          className="text-statement text-balance lg:col-span-5 lg:col-start-7"
        >
          Associate Product Manager on the Innovation team at DigiCert. Before that, founding AI
          engineer at FacilisAI.
        </motion.p>
      </Grid>

      <Grid className="mt-24">
        {/* Sized so the name runs the full width of the column */}
        <h1 className="font-display text-[calc((100vw-2.5rem)/3.2)] leading-[0.88] tracking-[-0.045em] sm:text-[min(calc((100vw-5rem)/5.55),calc((96rem-5rem)/5.55))] lg:col-span-12">
          <span className="block overflow-hidden pb-[0.06em]">
            <motion.span
              className="block"
              initial={{ y: '102%' }}
              animate={{ y: '0%' }}
              transition={{ duration: 1.3, delay: 0.1, ease: EASE }}
            >
              Zakaria <br className="sm:hidden" />
              Kortam
            </motion.span>
          </span>
        </h1>
      </Grid>
    </section>
  )
}
