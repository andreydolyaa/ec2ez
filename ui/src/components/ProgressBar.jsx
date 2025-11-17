import React from 'react';
import './ProgressBar.css';

/**
 * ProgressBar Component
 *
 * Displays exploitation progress with current step and percentage
 *
 * Props:
 * - currentStep: number - Current step (1-7)
 * - totalSteps: number - Total steps (default: 7)
 * - stepName: string - Name of current step
 * - isComplete: boolean - Whether exploitation is complete
 */
export default function ProgressBar({ currentStep, totalSteps = 7, stepName, isComplete }) {
  const percentage = isComplete ? 100 : Math.min(100, Math.round((currentStep / totalSteps) * 100));

  if (!currentStep && !isComplete) {
    return null; // Don't show before exploitation starts
  }

  return (
    <div className="progress-container">
      <div className="progress-info">
        <span className="progress-label">
          {isComplete ? '✓ Exploitation Complete' : `Step ${currentStep}/${totalSteps}: ${stepName}`}
        </span>
        <span className="progress-percentage">{percentage}%</span>
      </div>
      <div className="progress-bar">
        <div
          className={`progress-fill ${isComplete ? 'complete' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
