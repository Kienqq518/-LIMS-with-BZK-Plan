/** 当前登录用户（原型 mock）——个人信息气泡的唯一数据源，改这里就能全站生效 */
window.LimsCurrentUser = {
  name: 'admin',
  dept: '',                            // 部门留空：这个账号没挂部门，气泡里按空值规则显示「/」
  profile: {
    nickname: 'admin',                 // 用户昵称
    account: 'admin',                  // 用户账号
    gender: '男',
    dept: '',                          // 部门（同上，空值显示「/」）
    phone: '18379910424',
    email: '2655328518@qq.com',
    createTime: '2022-07-26 18:02:31',
    avatar: 'https://ui-avatars.com/api/?name=Admin&background=0ea5e9&color=fff&size=128',
    signature: 'assets/profile/signature-admin.svg'   // 电子签名，与顶栏头像同一个人
  }
};
