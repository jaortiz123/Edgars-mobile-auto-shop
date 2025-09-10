# Phase 3: Containers & Images - Dockerfile Standards Review
## Infrastructure & Deployment Audit #7

**Date**: 2025-09-09
**Phase**: 3.1 - Dockerfile Standards Assessment
**Status**: 🔍 **IN PROGRESS**

---

## Executive Summary

**Dockerfiles Found**: 8 unique Dockerfiles across the project
**Critical Issues Identified**: 5 security and standards violations
**Standards Compliance**: ❌ **NON-COMPLIANT** - Multiple critical issues

### Priority Issues
1. ❌ **No digest pinning** - All images use tags instead of SHA256 digests
2. ❌ **Missing HEALTHCHECK** - No health checks defined in any Dockerfile
3. ⚠️ **Mixed root/non-root usage** - Inconsistent privilege dropping
4. ⚠️ **No multi-stage builds** - Missing build optimization
5. ❌ **Lambda Dockerfiles lack USER directive** - Running as root unnecessarily

---

## 3.1 Dockerfile Standards Compliance Checklist

### ❌ **Distroless/Slim Base Images**
| File | Base Image | Compliant | Issues |
|------|------------|-----------|--------|
| `backend/Dockerfile` | `public.ecr.aws/lambda/python:3.9` | ⚠️ Partial | Lambda base appropriate, but no digest pinning |
| `frontend/Dockerfile` | `node:20-alpine` | ✅ Good | Alpine is slim, but missing digest |
| Docker Compose | `python:3.9-slim` | ✅ Good | Slim variant used, but missing digest |

**Recommendation**: Pin all images to specific SHA256 digests for supply chain security.

### ❌ **Digest Pinning (`@sha256:...`)**
**Status**: **CRITICAL FAILURE** - No images use digest pinning

All images use mutable tags instead of immutable digests:
- `public.ecr.aws/lambda/python:3.9` → Should be `public.ecr.aws/lambda/python:3.9@sha256:...`
- `node:20-alpine` → Should be `node:20-alpine@sha256:...`
- `python:3.9-slim` → Should be `python:3.9-slim@sha256:...`

### ❌ **Multi-Stage Builds**
**Status**: **NON-COMPLIANT** - No multi-stage builds found

Current Dockerfiles are single-stage, missing optimization opportunities:
- **Build dependencies** included in runtime image
- **Larger attack surface** due to unnecessary tools in final image
- **Inefficient caching** and slower builds

### ⚠️ **User Privilege Management (`USER app`)**
| File | Root Usage | Non-Root User | Compliant |
|------|------------|---------------|-----------|
| `backend/Dockerfile` | ❌ Running as root | ❌ No USER directive | ❌ Non-compliant |
| `frontend/Dockerfile` | ✅ Drops to `app` user | ✅ Creates non-root user | ✅ Compliant |
| Docker Compose | ❌ Running as root | ❌ No user specified | ❌ Non-compliant |

**Critical Issue**: Lambda containers running as root unnecessarily.

### ❌ **HEALTHCHECK Directives**
**Status**: **CRITICAL FAILURE** - No health checks implemented

None of the Dockerfiles include `HEALTHCHECK` instructions:
```dockerfile
# Missing from all Dockerfiles:
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:$PORT/health || exit 1
```

### ⚠️ **Layer Optimization**
Current issues:
- **Frontend**: Good layer organization with dependency caching
- **Backend/Lambda**: Single-layer approach, missing optimization
- **Docker Compose**: Runtime package installation (inefficient)

---

## 3.2 Security Assessment

### High-Risk Issues
1. **Supply Chain Vulnerability**: Mutable tags allow image substitution attacks
2. **Privilege Escalation**: Lambda functions running as root
3. **Container Breakout Risk**: No health monitoring for compromised containers
4. **Dependency Drift**: Build-time dependencies included in runtime

### Medium-Risk Issues
1. **Resource Consumption**: No resource constraints in containers
2. **Attack Surface**: Unnecessary packages in final images
3. **Monitoring Gap**: No container health visibility

---

## 3.3 Dockerfile-by-Dockerfile Analysis

### `backend/Dockerfile` (Lambda Function)
```dockerfile
FROM public.ecr.aws/lambda/python:3.9  # ❌ No digest pinning
RUN pip install psycopg2-binary         # ⚠️ Could be optimized
COPY booking_function.py ${LAMBDA_TASK_ROOT}
CMD [ "booking_function.lambda_handler" ]
```

**Issues**:
- ❌ No digest pinning
- ❌ No HEALTHCHECK (though Lambda provides its own)
- ❌ No USER directive (Lambda containers should still follow best practices)
- ⚠️ Single layer for dependencies

**Remediation**:
```dockerfile
FROM public.ecr.aws/lambda/python:3.9@sha256:[DIGEST]
RUN pip install psycopg2-binary==2.9.7 \
    && rm -rf /var/cache/pip/*
USER app
COPY booking_function.py ${LAMBDA_TASK_ROOT}
CMD [ "booking_function.lambda_handler" ]
```

### `frontend/Dockerfile` ✅ **Most Compliant**
```dockerfile
FROM node:20-alpine  # ❌ Missing digest only
# ... good user management ...
USER app             # ✅ Properly drops privileges
```

**Issues**:
- ❌ No digest pinning
- ❌ No HEALTHCHECK
- ✅ Good user management
- ✅ Proper layer organization

**Remediation**:
```dockerfile
FROM node:20-alpine@sha256:[DIGEST]
# ... existing code ...
HEALTHCHECK --interval=30s --timeout=3s CMD wget --quiet --tries=1 --spider http://localhost:5173/ || exit 1
```

### Docker Compose Service Configuration
**Issues**:
- ❌ Runtime package installation in entrypoint
- ❌ No digest pinning
- ❌ Running as root
- ❌ No health checks

---

## 3.4 Immediate Remediation Plan

### Priority 1: Critical Security (Week 1)
1. **Implement digest pinning** for all base images
2. **Add USER directives** to all Lambda Dockerfiles
3. **Create multi-stage builds** for production images
4. **Add HEALTHCHECK directives** where applicable

### Priority 2: Optimization (Week 2)
1. **Optimize Docker Compose** with proper Dockerfiles
2. **Implement layer caching** strategies
3. **Add resource constraints** to containers
4. **Create production-optimized images**

### Priority 3: Advanced Security (Week 3)
1. **Implement image signing** with cosign
2. **Add SBOM generation** to build process
3. **Integrate vulnerability scanning** in CI
4. **Implement runtime security policies**

---

## Next Steps

1. **Execute container scanning** (Section 3.2): hadolint, syft, grype
2. **Generate compliance reports** and commit to audit_artifacts
3. **Create remediated Dockerfiles** with security best practices
4. **Update docker-compose.yml** with production-ready configuration

---

**Assessment Status**: ❌ **NON-COMPLIANT**
**Critical Issues**: 5 security violations requiring immediate attention
**Estimated Remediation Time**: 2-3 weeks for complete compliance
