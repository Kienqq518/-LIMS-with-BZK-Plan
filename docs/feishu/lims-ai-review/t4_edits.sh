set -e
D=NmYVdjPO9oswaoxyHsDcQNu2nKh
r(){ lark-cli docs +update --doc $D --command block_replace --block-id "$1" --content "$2" --as user --jq '{t:"'"$3"'",ok:.data.result,e:.error.message}' 2>&1 | tr -d '\n '; echo; }
r PRoCdsVpoolsnyxfWbIcyyAZnmQ '<p>平行试样 / 重复测定组数满足该品类标准规定（示例：螺栓连接副每批 8 套；取值见 3.9）</p>' "A03组数"
r C03sdxBnhodI19xKvAAcBeZYnnb '<p>可追溯编号与取样部位记录完整，载体按品类为炉（批）号 / 盘号 / 制造批号 / 段号（见 3.9）</p>' "A03追溯"
r OEBrdDnpWoFWZrxCKfMcuXjLn3f '<p>对温湿度敏感的试验项目须记录环境温湿度，敏感项目清单按品类取（示例：拉伸、扭矩系数、工频耐压；取值见 3.9）</p>' "A02温湿度"
r GmURdhB2yoJnNJxOFP2c4KzinTR '<p>安全工器具上次预防性试验未超期，周期按品类取（示例：绝缘手套 6 个月；取值见 3.9）</p>' "B01周期"
r XBshdqaeKooetAxO7G6csyIOnzh '<p>扭矩系数平均值与标准偏差满足所引标准（示例：GB/T 1231 的 0.110–0.150 与 ≤ 0.0074；取值见 3.9）</p>' "B02扭矩"
r JVSKdm28pomWfNxc0qPcf8uDnod '<p>数值修约间隔与所引标准一致（示例：抗拉强度 1 MPa、扭矩系数 3 位小数；取值见 3.9）</p>' "C01修约"
r doxcnXlQi09l20J7UIL2ZdvZbTf '<p>规则体系分三类，本体 <b>45 条</b>（通用集 28 + 品类专属 17），M1 出口目标 <b>≥ 50 条</b>——差额由品类专属规则补齐，见 3.9 与附录 B。全部为确定性 if-then 判定，不引入概率输出：这既是准确率能达到 99% 的前提，也让审核员对每一条提示都可复核、可反驳。<b>本表判据内不写品类数值</b>，启用与否、参数、依据一律由 3.9 的绑定表决定。</p>' "3.2.1导语"
