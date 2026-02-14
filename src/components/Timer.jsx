import { useState, useEffect, useRef } from 'react';

export default function Timer({ duration = 10, onTimeout, onTick }) {
    const [remaining, setRemaining] = useState(duration);
    const intervalRef = useRef(null);
    const startTimeRef = useRef(Date.now());

    useEffect(() => {
        startTimeRef.current = Date.now();

        intervalRef.current = setInterval(() => {
            const elapsed = (Date.now() - startTimeRef.current) / 1000;
            const left = Math.max(0, duration - elapsed);
            setRemaining(left);
            onTick?.(left);

            if (left <= 0) {
                clearInterval(intervalRef.current);
                onTimeout?.();
            }
        }, 100);

        return () => clearInterval(intervalRef.current);
    }, [duration, onTimeout, onTick]);

    const progress = remaining / duration;
    const circumference = 2 * Math.PI * 50;
    const dashOffset = circumference * (1 - progress);

    const getColor = () => {
        if (remaining > 5) return '#10b981';
        if (remaining > 3) return '#f59e0b';
        return '#ef4444';
    };

    const isUrgent = remaining <= 3 && remaining > 0;

    return (
        <div className="timer-ring" style={{ margin: '0 auto' }}>
            <svg width="120" height="120" viewBox="0 0 120 120">
                <circle className="timer-ring-track" cx="60" cy="60" r="50" />
                <circle
                    className="timer-ring-fill"
                    cx="60" cy="60" r="50"
                    stroke={getColor()}
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                />
            </svg>
            <div className={`timer-text ${isUrgent ? 'timer-urgent' : ''}`} style={{ color: getColor() }}>
                {Math.ceil(remaining)}s
            </div>
        </div>
    );
}
