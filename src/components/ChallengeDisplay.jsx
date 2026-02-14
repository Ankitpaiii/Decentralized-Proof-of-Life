export default function ChallengeDisplay({ challenge }) {
    if (!challenge) return null;

    return (
        <div className="challenge-instruction animate-fadeInDown">
            <div className="challenge-icon">{challenge.icon}</div>
            <div className="text-gradient" style={{ fontSize: '1.6rem', fontWeight: 800 }}>
                {challenge.instruction}
            </div>
            <p className="text-muted text-sm mt-sm">Perform this action within the time limit</p>
        </div>
    );
}
