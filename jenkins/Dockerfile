# Jenkins controller with a Docker CLI (+ buildx/compose plugins).
# It talks to the host's Docker daemon through the mounted /var/run/docker.sock.
FROM jenkins/jenkins:lts

USER root
COPY --from=docker:27.3.1-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker:27.3.1-cli /usr/local/libexec/docker/cli-plugins /usr/local/libexec/docker/cli-plugins
USER jenkins
