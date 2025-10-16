FROM eclipse-temurin:21-jre
ENV JAVA_TOOL_OPTIONS="-Djava.net.preferIPv4Stack=true -Djava.net.preferIPv6Addresses=false"

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		python3 python3-pip python3-venv \
		libglib2.0-0 libsm6 libxext6 libxrender1 libgl1 \
	&& rm -rf /var/lib/apt/lists/*

COPY AI/requirements.txt /app/AI/requirements.txt

RUN python3 -m venv /opt/ai-venv \
	&& /opt/ai-venv/bin/pip install --no-cache-dir -r /app/AI/requirements.txt

COPY AI /app/AI

ENV VIRTUAL_ENV=/opt/ai-venv
ENV PATH=${VIRTUAL_ENV}/bin:${PATH} \
	APP_AI_PYTHON=/opt/ai-venv/bin/python \
	APP_AI_SCRIPT=/app/AI/analyze.py \
	APP_AI_TUNING_SCRIPT=/app/AI/tune_parameters.py

COPY target/transformer-tracker-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080

CMD ["java", "-jar", "app.jar"]
