{{/*
Expand the name of the chart.
*/}}
{{- define "yontrack-mcp-chart.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
Truncate at 63 chars because some Kubernetes name fields are limited.
*/}}
{{- define "yontrack-mcp-chart.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart label.
*/}}
{{- define "yontrack-mcp-chart.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "yontrack-mcp-chart.labels" -}}
helm.sh/chart: {{ include "yontrack-mcp-chart.chart" . }}
{{ include "yontrack-mcp-chart.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Name of the secret to use for credentials.
*/}}
{{- define "yontrack-mcp-chart.secretName" -}}
{{- .Values.existingSecret | default (include "yontrack-mcp-chart.fullname" .) }}
{{- end }}

{{/*
Selector labels.
*/}}
{{- define "yontrack-mcp-chart.selectorLabels" -}}
app.kubernetes.io/name: {{ include "yontrack-mcp-chart.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
