# SQLGuard - Fullstack Project

SQLi (SQL injection) attacks remain a pervasive threat to database-driven applications, allowing malicious actors to manipulate database queries and gain unauthorized access to confidential information to compromise system integrity. To address this critical concern, this project presents a Real-time SQLi Monitoring and Detection Dashboard designed for system administrators in organizations to proactively detect, analyze and mitigate SQLi threats as they occur. The proposed solution is tailor-made for security teams managing web applications, particularly those with login systems susceptible to SQLi in real-world scenarios. The key challenge addressed is the lack of real-time visibility in SQLi attacks and the absence of centralized monitoring tools for administrators. Traditional security initiatives often focus on post-attack analysis and mitigation rather than instantaneous detection and response, leaving enterprise systems vulnerable to constant threats. The main goal of this project is to develop a robust, real-time monitoring and detection system that provides immediate alerts, actionable insights and comprehensive security controls. It emphasizes real-time analysis of login attempts and user inputs. The approach involves three crucial components; A flask backend, employing REGEX pattern-based matching to detect SQLi attempts dynamically, a deliberately vulnerable login page built with React which serves as the testbed for simulation of attack scenarios, and a react and tailwind-CSS based dashboard featuring real-time attack logs, chart visualizations of SQLi activity, and configurable security settings. The combination of real-time detection with adequate visualization helps enhance web application security, enforce strong authentication mechanisms and minimize response times. This implementation provides organizations with a practical, user-friendly interface to strengthen their defense against SQLi attacks while offering detailed insights which align with modern cybersecurity frameworks and best practices.

**Keywords**: SQL Injection, Real-time Detection, Attacks, REGEX, Security

# Dependencies 
pip install numpy, pandas, flask, scikit-learn, flask_cors, flask_sqlalchemy, flask.socketio, requestsFaker, ProxyFix

# Notes 

In conclusion, the Real-time SQLi Monitoring and Detection Dashboard offers a significant advancement in addressing the persistent threat of SQL injection attacks on database-driven applications. This innovative solution bridges a critical gap in cybersecurity infrastructure by shifting from reactive post-attack analysis to proactive real-time detection and response. By integrating pattern-based REGEX matching with comprehensive visualization tools, the system enables security administrators to identify, analyze, and mitigate SQLi threats as they emerge, substantially reducing vulnerability windows.
The three-component architecture—combining a Flask backend for detection, a React-based vulnerable testbed for simulation, and an intuitive dashboard for monitoring—provides organizations with both practical security enhancement and valuable educational insights. Empirical testing demonstrates the system's effectiveness in detecting various SQLi attack vectors while maintaining performance efficiency. Future work could expand this framework to incorporate machine learning for improved pattern recognition. This solution not only strengthens organizational defense against one of the most prevalent web application vulnerabilities but also aligns with evolving cybersecurity best practices that emphasize real-time threat intelligence and visualization in security operations.

# LICENSE 

This project is protected under **All Rights Reserved**.

You are **not permitted** to copy, use, modify, distribute, sublicense, or rebrand any part of this codebase, in whole or in part, without **explicit written permission** from the author.

© 2025 Priyankaa Vijay. All rights reserved.


