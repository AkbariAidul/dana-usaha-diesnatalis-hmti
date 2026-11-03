import Link from 'next/link'

export type Step = { label: string; href?: string }

type PoStepperProps = {
  steps: Step[]
  currentStep: number
  onStepClick?: (step: number) => void
}

export function PoStepper({ steps, currentStep }: PoStepperProps) {
  return (
    <nav aria-label="Progress PO" className="mb-6">
      <ol className="flex items-center overflow-x-auto">
        {steps.map((step, idx) => {
          const stepNum = idx + 1
          const isActive = stepNum === currentStep
          const isCompleted = stepNum < currentStep
          const isClickable = isCompleted && !!step.href

          return (
            <li key={idx} className="flex items-center">
              {idx > 0 && (
                <div className={`h-0.5 w-6 sm:w-10 md:w-12 ${isCompleted ? 'bg-violet-600' : 'bg-slate-200'} mx-1`} />
              )}
              {isClickable ? (
                <Link
                  href={step.href!}
                  className="flex flex-col items-center gap-1.5 px-2 py-1.5 text-center"
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                    isActive ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-700'
                  }`}>
                    {stepNum}
                  </span>
                  <span className={`hidden text-[10px] font-medium sm:block ${
                    isActive ? 'text-violet-700' : isCompleted ? 'text-slate-600' : 'text-slate-400'
                  }`}>{step.label}</span>
                </Link>
              ) : (
                <div className="flex flex-col items-center gap-1.5 px-2 py-1.5 text-center">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                    isActive ? 'bg-violet-600 text-white' : isCompleted ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {isCompleted ? '✓' : stepNum}
                  </span>
                  <span className={`hidden text-[10px] font-medium sm:block ${
                    isActive ? 'text-violet-700' : isCompleted ? 'text-slate-600' : 'text-slate-400'
                  }`}>{step.label}</span>
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
