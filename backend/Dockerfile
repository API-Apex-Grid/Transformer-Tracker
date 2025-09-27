FROM eclipse-temurin:21-jre
ENV JAVA_TOOL_OPTIONS="-Djava.net.preferIPv4Stack=true -Djava.net.preferIPv6Addresses=false"

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 python3-pip \
	&& pip3 install --no-cache-dir --break-system-packages Pillow \
	&& rm -rf /var/lib/apt/lists/*

COPY /AI /app/AI

ENV APP_AI_PYTHON=python3 \
	APP_AI_SCRIPT=/app/AI/analyze.py

COPY target/transformer-tracker-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080

CMD ["java", "-jar", "app.jar"]
