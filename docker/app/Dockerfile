FROM public.ecr.aws/docker/library/python:3.12-slim
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4 /lambda-adapter /opt/extensions/lambda-adapter
ENV AWS_LWA_PORT=8501
ENV AWS_LWA_READINESS_CHECK_PATH=/healthz


RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    software-properties-common \
    git \
    && rm -rf /var/lib/apt/lists/* 

RUN addgroup --gid 8000 streamlit && \
    adduser --uid 8000 --gid 8000 --disabled-password --gecos "" streamlit

USER streamlit
WORKDIR /home/streamlit/app

COPY ./ ./

RUN pip3 install -r requirements.txt

ENV PATH=/home/streamlit/.local/bin:$PATH
EXPOSE 8501

HEALTHCHECK CMD curl --fail http://localhost:8501/_stcore/health

ENTRYPOINT ["streamlit", "run", "chatapi.py", "--server.port=8501", "--server.address=0.0.0.0"]
