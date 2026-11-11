# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

hybrid application: web frontend, AI/backend service, X Layer contracts, TapeOut Circuit, and DeWEB publishing

## Users

主要用户是希望参与 AI 创作但不想从零开始的普通用户、AI 创作者、设计师和内容创作者。创作者发布一个允许 remix 的 Seed；参与者选择一个已有版本和变化方向，由 AI 帮助生成下一棒，再把它交给下一位参与者。

## Product Purpose

AI Remix Relay 是一个支持图片与文字的多人接力创作网络。它把一次性的 AI 生成变成可继续传递的共创过程：每个版本都有明确的父作品、内容类型、创作者、AI 调用、授权和贡献关系，并可继续产生下一代版本。首版成功标准是两个真实用户能够完成“Seed → AI remix → 发布下一棒 → 接力继续”的完整闭环。

## Positioning

不是通用 AI 图片生成器、Campaign 管理工具、素材批量适配工具或 NFT 市场。独特机制是 Relay Graph：每个 AI 输出同时是一个可继续创作的节点；同一套谱系也适用于文字接力。TapeOut Circuit 约束每一棒允许的变化与授权条件，X Layer 记录 parent-child、版本承诺和分成，AI 负责实际内容生成。

## Operating Context

用户从公开 Relay Feed 发现一个 Seed，点击“接下一棒”，选择变化类型并输入创作意图。AI 返回三个候选版本，用户选择一个发布；系统生成 Relay Receipt、更新谱系，并允许用户公开邀请或通过 TapeSend 指定下一位创作者。普通用户先体验，发布或收费能力再请求钱包。

## Capabilities and Constraints

- 核心闭环：发现 Relay、选择图片或文字 Seed、接下一棒、AI 生成候选、选择版本、发布、查看谱系、邀请下一位。
- Relay 节点必须包含 parent、creator、content hash、AI receipt、license、rule result、split、timestamp。
- `RelayRule` TapeOut Circuit 负责判断 parent 是否存在、授权是否接受、变化类型是否允许、署名是否保留以及分支是否开放。
- X Layer `RelayRegistry` 负责节点承诺、parent-child 关系、授权与分成；付费 Relay 通过合约结算。
- AI 服务端生成可验证的调用回执；TapeSend 可用于定向交接；TapeKit/DeWEB 可用于发布永久 Relay 页面。TapeAPI 属第三方生态能力，只有完成 X Layer 兼容性验证后才考虑接入，不能用它替代 X Layer 的硬性要求。
- 需要真实 AI 服务、后端存储和多用户账户；本地 Canvas 只可作为降级预览，不得冒充 AI 生成。
- 链上写入、支付、Circuit 判定和 DeWEB 发布在完成前必须明确标记为未接入。

## Revenue Model

- 免费用户可参加公开 Relay 并获得有限 AI 额度。
- 用户按次购买 AI remix credits，或订阅 Creator Plan。
- 创作者可发布付费 Seed、出售风格模板，并从后续 remix 或收藏中获得分成。
- 平台从 AI 调用、付费 Relay 和模板交易中收取透明服务费。

## Brand Commitments

产品名：AI Remix Relay。核心语言是“接下一棒”“生成下一版”“传给下一位”“查看作品谱系”。Web3 技术隐藏在用户流程之后，不使用 Campaign、审核后台或基础设施叙事作为主产品。

## Evidence on Hand

当前仓库已有服务器化的 AI Remix Relay：D1 保存 Relay、节点、邀请、Credits 与用量账本，R2 保存图片或文字 Seed 和候选作品；用户可在没有 AI Key 时上传并发起真实 Seed、创建可追踪邀请、接受接棒、查看收件箱和自己的创作。节点记录内容类型、真实文件哈希、授权、分成和应用层规则预检，生成接口具备限流、幂等、Credits 预扣与失败退款。公网 Worker 已部署，X Layer 只读 RPC 可运行。OpenAI Secret、RelayRule TapeOut Circuit、RelayRegistry 链上写入、真实支付、TapeSend 和 DeWEB 尚未完成，不能宣称为已交付能力。

## Product Principles

1. AI 创作是核心，链上能力服务于接力规则、来源和分成。
2. 用户第一次进入后一分钟内必须完成第一棒。
3. 每个版本都必须能回到父作品，也必须能继续向下接力。
4. Relay 必须有持续参与理由，而不是生成一次即结束。
5. 只展示真实完成的能力和可核验数据。

## Accessibility & Inclusion

不要求用户预先理解钱包、Circuit 或合约；核心体验支持游客模式、键盘和移动端，发布或付费时再请求钱包。
