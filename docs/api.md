# 接口文档

## 1. 用户登录接口

### 接口地址
`POST /api/users/login`

### 请求头
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| Content-Type | string | 是 | application/json |

### 请求体
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| username | string | 是 | 用户名 |
| password | string | 是 | 密码 |

**请求示例：**
```json
{
  "username": "user123",
  "password": "password123"
}
```

### 成功响应 (200 OK)
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| token | string | JWT访问令牌（有效期24小时） |
| user | object | 用户信息 |
| user.id | number | 用户ID |
| user.username | string | 用户名 |

**成功响应示例：**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "user123"
  }
}
```

### 失败响应
| HTTP状态码 | 错误信息 | 说明 |
| --- | --- | --- |
| 400 | `{"error": "请输入用户名和密码"}` | 缺少用户名或密码 |
| 401 | `{"error": "用户名或密码错误"}` | 用户名不存在或密码错误 |
| 500 | `{"error": "登录失败"}` | 服务器内部错误 |

---

## 2. 获取已完成的剧本列表接口

### 接口地址
`GET /api/scripts`

### 请求头
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| Authorization | string | 是 | Bearer token |

### 请求参数（Query）
| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| page | number | 否 | 1 | 页码 |
| pageSize | number | 否 | 10 | 每页条数 |
| status | string | 否 | - | 状态筛选（不传则返回所有状态） |

> **说明**：要获取已完成的剧本，需设置 `status=completed`

### 成功响应 (200 OK)
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| data | array | 剧本列表 |
| data[].id | number | 剧本ID |
| data[].user_id | number | 用户ID |
| data[].topic | string | 剧本主题 |
| data[].outline | string | 剧本大纲 |
| data[].status | string | 剧本状态 |
| data[].username | string | 创建者用户名 |
| data[].created_at | string | 创建时间 |
| total | number | 总条数 |
| page | number | 当前页码 |
| pageSize | number | 每页条数 |

**成功响应示例：**
```json
{
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "topic": "星际探险",
      "outline": "未来太空探索的故事...",
      "status": "completed",
      "username": "user123",
      "created_at": "2024-01-15 10:30:00"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 10
}
```

### 失败响应
| HTTP状态码 | 错误信息 | 说明 |
| --- | --- | --- |
| 401 | `{"error": "Unauthorized"}` | 未登录或token无效 |
| 500 | `{"error": "获取剧本列表失败"}` | 服务器内部错误 |

---

## 3. 获取指定剧本的最新章节信息列表接口

### 接口地址
`GET /api/scripts/:scriptId/chapters`

### 请求头
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| Authorization | string | 是 | Bearer token |

### 路径参数
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| scriptId | number | 是 | 剧本ID |

### 成功响应 (200 OK)
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| scriptId | number | 剧本ID |
| chapters | array | 章节列表（按章节号升序排列） |
| chapters[].chapter_number | number | 章节编号 |
| chapters[].chapter_title | string | 章节标题 |
| chapters[].chapter_content | string | 章节内容 |
| chapters[].created_at | string | 创建时间 |

**成功响应示例：**
```json
{
  "scriptId": 1,
  "chapters": [
    {
      "chapter_number": 1,
      "chapter_title": "第一章：启程",
      "chapter_content": "公元2150年，人类终于实现了星际旅行的梦想...",
      "created_at": "2024-01-15 11:00:00"
    },
    {
      "chapter_number": 2,
      "chapter_title": "第二章：发现",
      "chapter_content": "飞船在M78星云附近发现了一颗神秘的星球...",
      "created_at": "2024-01-15 11:30:00"
    }
  ]
}
```

### 失败响应
| HTTP状态码 | 错误信息 | 说明 |
| --- | --- | --- |
| 401 | `{"error": "Unauthorized"}` | 未登录或token无效 |
| 404 | `{"error": "剧本不存在"}` | 剧本ID无效或已删除 |
| 500 | `{"error": "获取剧本章节失败"}` | 服务器内部错误 |

---

## 认证说明

所有需要登录的接口均需在请求头中携带 `Authorization` 字段：

```
Authorization: Bearer <your_token>
```

其中 `<your_token>` 为登录接口返回的 `token` 值。