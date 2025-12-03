import styles from './sunset.module.css';

export default function SunsetPage() {
    return (
        <div className={styles.container}>
            <div className={styles.skyContainer}></div>
            <div className={styles.sun}></div>

            <div className={styles.content}>
                <h1 className={styles.heading}>Setting the Sun</h1>
                
                <p className={styles.paragraph}>
                    All great journeys eventually find their horizon. After much innovation and growth, we are officially setting the sun on <strong>Apex Grid</strong>.
                </p>
                
                <p className={styles.paragraph}>
                    While this specific chapter is closing, the code we wrote, the lessons we learned, and the community we built remain. We are deeply grateful to everyone who walked this path with us.
                </p>

                <a href="https://github.com/API-Apex-Grid/Transformer-Tracker" className={styles.btn}>Visit the Repository</a>

                <div className={styles.quote}>
                    &quot;What we call the beginning is often the end. And to make an end is to make a beginning. The end is where we start from.&quot;
                </div>
            </div>
        </div>
    );
}
