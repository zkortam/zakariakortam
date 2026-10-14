import { Grid } from './Container'
import { Fade } from './Motion'

/** Inner-page head: title large at column 1, a statement at column 7. */
export function PageHead({ title, statement }: { title: string; statement?: string }) {
  return (
    <Grid className="gap-y-10 pt-36 sm:pt-48">
      <Fade now className="lg:col-span-6">
        <h1 className="font-display text-title">{title}</h1>
      </Fade>
      {statement && (
        <Fade now delay={0.15} className="text-statement text-balance lg:col-span-5 lg:col-start-7 lg:pt-3">
          {statement}
        </Fade>
      )}
    </Grid>
  )
}
